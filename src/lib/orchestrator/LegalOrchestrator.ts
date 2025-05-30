import { LegalAgent, AgentInput, AgentOutput, AgentOrchestrationPlan, AgentTask } from '@/lib/agents/types';
import { ResearchAgent } from '@/lib/agents/ResearchAgent';
import { BriefWritingAgent } from '@/lib/agents/BriefWritingAgent';
import { DiscoveryAgent } from '@/lib/agents/DiscoveryAgent';
import { ContractAgent } from '@/lib/agents/ContractAgent';
import { AgentTaskQueue } from '@/lib/agents/AgentTaskQueue';
import { supabaseAdmin } from '@/lib/supabase/client';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';

export class LegalOrchestrator {
  private agents: Map<string, LegalAgent> = new Map();
  private taskQueue: AgentTaskQueue;
  private supabase = supabaseAdmin;
  private runningOrchestrations = new Map<string, AbortController>();
  private llm: BaseChatModel | null = null;
  private strParser = new StringOutputParser();
  private chatModel?: { name: string; provider: string };

  constructor(chatModel?: { name: string; provider: string }) {
    this.chatModel = chatModel;
    this.taskQueue = new AgentTaskQueue();
    this.initializeAgents();
    this.initializeLLM();
  }

  private async initializeLLM() {
    try {
      this.llm = await getDefaultChatModel();
      if (this.llm && 'temperature' in this.llm) {
        (this.llm as any).temperature = 0.1; // Low temperature for consistent intent analysis
      }
    } catch (error) {
      console.error('Failed to initialize LLM for LegalOrchestrator:', error);
    }
  }

  private initializeAgents(): void {
    const researchAgent = new ResearchAgent();
    const briefWritingAgent = new BriefWritingAgent();
    const discoveryAgent = new DiscoveryAgent();
    const contractAgent = new ContractAgent();

    this.agents.set('research', researchAgent);
    this.agents.set('brief-writing', briefWritingAgent);
    this.agents.set('discovery', discoveryAgent);
    this.agents.set('contract', contractAgent);
  }

  async orchestrateWorkflow(
    matterId: string,
    userQuery: string,
    context?: Record<string, any>
  ): Promise<AgentOrchestrationPlan> {
    try {
      // Analyze user intent and determine required agents
      const plan = await this.createOrchestrationPlan(matterId, userQuery, context);
      
      // Execute the orchestration plan
      await this.executePlan(plan);
      
      return plan;
    } catch (error) {
      console.error('Orchestration failed:', error);
      throw new Error(`Failed to orchestrate workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createOrchestrationPlan(
    matterId: string,
    userQuery: string,
    context?: Record<string, any>
  ): Promise<AgentOrchestrationPlan> {
    const queryIntent = await this.analyzeUserIntent(userQuery);
    const requiredAgents = await this.determineRequiredAgents(queryIntent, context);
    const agentDependencies = this.buildDependencyGraph(requiredAgents, queryIntent);

    const plan: AgentOrchestrationPlan = {
      id: `orchestration-${Date.now()}`,
      matterId,
      userQuery,
      agents: agentDependencies,
      totalEstimatedDuration: this.calculateTotalDuration(agentDependencies),
      status: 'planned',
      createdAt: new Date()
    };

    // Store the plan in database
    await this.storePlan(plan);
    
    return plan;
  }

  private async analyzeUserIntent(userQuery: string): Promise<any> {
    if (!this.llm) {
      return this.analyzeUserIntentBasic(userQuery);
    }

    const intentPrompt = PromptTemplate.fromTemplate(`
Analyze this legal request and determine the user's intent and requirements.

User Query: {query}

Analyze and return the following in JSON format:
{{
  "primaryAction": "research|writing|analysis|discovery|contract_analysis|compliance|litigation",
  "secondaryActions": ["additional actions that may be needed"],
  "documentTypes": ["contract|brief|memo|motion|agreement|discovery|opinion|pleading"],
  "analysisDepth": "summary|standard|comprehensive|expert",
  "urgency": "low|normal|high|critical",
  "practiceArea": "corporate|litigation|employment|ip|real_estate|tax|criminal|family|other",
  "jurisdiction": "federal|state|international|unknown",
  "complexity": "simple|moderate|complex|highly_complex",
  "estimatedDuration": "time estimate in minutes",
  "keyRequirements": ["specific requirements extracted from query"],
  "suggestedWorkflow": ["recommended sequence of agent actions"]
}}

Focus on understanding the legal context and practical requirements.`);

    try {
      const chain = intentPrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({ query: userQuery });
      
      const cleanResult = result.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleanResult);
    } catch (error) {
      console.error('AI intent analysis failed:', error);
      return this.analyzeUserIntentBasic(userQuery);
    }
  }

  private analyzeUserIntentBasic(userQuery: string): any {
    const query = userQuery.toLowerCase();
    const intent = {
      primaryAction: 'unknown',
      secondaryActions: [] as string[],
      documentTypes: [] as string[],
      analysisDepth: 'standard',
      urgency: 'normal',
      practiceArea: 'other',
      jurisdiction: 'unknown',
      complexity: 'moderate',
      estimatedDuration: '60',
      keyRequirements: [] as string[],
      suggestedWorkflow: [] as string[]
    };

    // Determine primary action
    if (query.includes('research') || query.includes('find') || query.includes('search')) {
      intent.primaryAction = 'research';
    } else if (query.includes('write') || query.includes('draft') || query.includes('generate')) {
      intent.primaryAction = 'writing';
    } else if (query.includes('review') || query.includes('analyze') || query.includes('examine')) {
      intent.primaryAction = 'analysis';
    } else if (query.includes('discovery') || query.includes('privilege')) {
      intent.primaryAction = 'discovery';
    } else if (query.includes('contract')) {
      intent.primaryAction = 'contract_analysis';
    }

    // Determine document types
    const documentTypes = ['contract', 'brief', 'memo', 'motion', 'agreement', 'discovery'];
    for (const docType of documentTypes) {
      if (query.includes(docType)) {
        intent.documentTypes.push(docType);
      }
    }

    // Determine analysis depth
    if (query.includes('comprehensive') || query.includes('detailed') || query.includes('thorough')) {
      intent.analysisDepth = 'comprehensive';
    } else if (query.includes('quick') || query.includes('brief') || query.includes('summary')) {
      intent.analysisDepth = 'summary';
    }

    // Determine urgency
    if (query.includes('urgent') || query.includes('asap') || query.includes('immediately')) {
      intent.urgency = 'high';
    } else if (query.includes('when possible') || query.includes('no rush')) {
      intent.urgency = 'low';
    }

    return intent;
  }

  private async determineRequiredAgents(intent: any, context?: Record<string, any>): Promise<string[]> {
    if (!this.llm) {
      return this.determineRequiredAgentsBasic(intent, context);
    }

    const agentSelectionPrompt = PromptTemplate.fromTemplate(`
Determine which legal agents are needed for this task.

Intent Analysis: {intent}
Context: {context}

Available Agents:
- research: Legal research, case law, statutory analysis
- brief-writing: Legal document drafting, memoranda, briefs
- discovery: Document review, privilege analysis, discovery responses
- contract: Contract analysis, risk assessment, term extraction

Consider:
1. Primary action requirements
2. Document types involved
3. Complexity and analysis depth
4. Workflow dependencies

Return a JSON array of required agent names in execution order:
["agent1", "agent2", ...]

Example: ["research", "brief-writing"] for a memo that needs research first.`);

    try {
      const chain = agentSelectionPrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({
        intent: JSON.stringify(intent, null, 2),
        context: JSON.stringify(context || {}, null, 2)
      });
      
      const cleanResult = result.replace(/```json\n?|```/g, '').trim();
      const agents = JSON.parse(cleanResult);
      
      // Validate agent names
      const validAgents = ['research', 'brief-writing', 'discovery', 'contract'];
      const filteredAgents = agents.filter((agent: string) => validAgents.includes(agent));
      
      return filteredAgents.length > 0 ? filteredAgents : ['research']; // Default fallback
    } catch (error) {
      console.error('AI agent selection failed:', error);
      return this.determineRequiredAgentsBasic(intent, context);
    }
  }

  private determineRequiredAgentsBasic(intent: any, context?: Record<string, any>): string[] {
    const agents = [];

    switch (intent.primaryAction) {
      case 'research':
        agents.push('research');
        if (intent.documentTypes?.includes('brief') || intent.documentTypes?.includes('memo')) {
          agents.push('brief-writing');
        }
        break;

      case 'writing':
        agents.push('brief-writing');
        if (!context?.skipResearch) {
          agents.push('research'); // Research usually needed for writing
        }
        break;

      case 'analysis':
        if (intent.documentTypes?.includes('contract')) {
          agents.push('contract');
        } else {
          agents.push('research');
        }
        break;

      case 'discovery':
        agents.push('discovery');
        break;

      case 'contract_analysis':
        agents.push('contract');
        if (intent.analysisDepth === 'comprehensive') {
          agents.push('research'); // For regulatory compliance research
        }
        break;

      default:
        // Default workflow: research first
        agents.push('research');
        break;
    }

    return [...new Set(agents)]; // Remove duplicates
  }

  private buildDependencyGraph(requiredAgents: string[], intent: any): any[] {
    const agentConfigs = [];
    let priority = 1;

    // Define dependencies between agents
    const dependencies: Record<string, string[]> = {
      'research': [], // No dependencies
      'brief-writing': ['research'], // Depends on research
      'discovery': [], // Independent
      'contract': [] // Independent
    };

    for (const agentType of requiredAgents) {
      const agent = this.agents.get(agentType);
      if (!agent) continue;

      const estimatedDuration = this.estimateAgentDuration(agentType, intent);
      
      agentConfigs.push({
        agentType,
        dependencies: dependencies[agentType] || [],
        priority: priority++,
        estimatedDuration
      });
    }

    // Sort by dependencies (independent agents first)
    return agentConfigs.sort((a, b) => a.dependencies.length - b.dependencies.length);
  }

  private estimateAgentDuration(agentType: string, intent: any): number {
    const baseDurations = {
      'research': 60,
      'brief-writing': 120,
      'discovery': 180,
      'contract': 90
    };

    const base = baseDurations[agentType as keyof typeof baseDurations] || 60;
    
    // Adjust for analysis depth
    const depthMultiplier = {
      'summary': 0.7,
      'standard': 1.0,
      'comprehensive': 1.5
    };

    // Adjust for urgency
    const urgencyMultiplier = {
      'low': 1.2,
      'normal': 1.0,
      'high': 0.8 // Faster execution for urgent requests
    };

    return Math.round(
      base * 
      (depthMultiplier[intent.analysisDepth as keyof typeof depthMultiplier] || 1.0) *
      (urgencyMultiplier[intent.urgency as keyof typeof urgencyMultiplier] || 1.0)
    );
  }

  private calculateTotalDuration(agentConfigs: any[]): number {
    // For agents with dependencies, add durations sequentially
    // For independent agents, take the maximum duration
    let totalDuration = 0;
    let independentDuration = 0;

    for (const config of agentConfigs) {
      if (config.dependencies.length === 0) {
        independentDuration = Math.max(independentDuration, config.estimatedDuration);
      } else {
        totalDuration += config.estimatedDuration;
      }
    }

    return Math.max(totalDuration, independentDuration);
  }

  private async executePlan(plan: AgentOrchestrationPlan): Promise<void> {
    const controller = new AbortController();
    this.runningOrchestrations.set(plan.id, controller);

    try {
      await this.updatePlanStatus(plan.id, 'executing');

      // Execute agents in dependency order
      const executionResults = new Map<string, AgentOutput>();
      
      for (const agentConfig of plan.agents) {
        if (controller.signal.aborted) {
          throw new Error('Orchestration was cancelled');
        }

        // Wait for dependencies to complete
        await this.waitForDependencies(agentConfig.dependencies, executionResults);

        // Prepare input for agent
        const agentInput = await this.prepareAgentInput(
          plan.matterId, 
          plan.userQuery, 
          agentConfig,
          executionResults
        );

        // Execute agent
        const result = await this.executeAgent(agentConfig.agentType, agentInput);
        executionResults.set(agentConfig.agentType, result);
      }

      await this.updatePlanStatus(plan.id, 'completed');
    } catch (error) {
      await this.updatePlanStatus(plan.id, 'failed');
      throw error;
    } finally {
      this.runningOrchestrations.delete(plan.id);
    }
  }

  private async waitForDependencies(
    dependencies: string[], 
    executionResults: Map<string, AgentOutput>
  ): Promise<void> {
    for (const dependency of dependencies) {
      while (!executionResults.has(dependency)) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      }
    }
  }

  private async prepareAgentInput(
    matterId: string,
    userQuery: string,
    agentConfig: any,
    executionResults: Map<string, AgentOutput>
  ): Promise<AgentInput> {
    const context: Record<string, any> = {};

    // Add matter info to context
    try {
      const { data: matter } = await this.supabase
        .from('matters')
        .select('*')
        .eq('id', matterId)
        .single();
      
      if (matter) {
        context.matter_info = matter;
      }
    } catch (error) {
      console.error('Failed to load matter info:', error);
    }

    // Add results from dependency agents
    for (const dependency of agentConfig.dependencies) {
      const dependencyResult = executionResults.get(dependency);
      if (dependencyResult) {
        context[`${dependency}_results`] = dependencyResult.result;
      }
    }

    return {
      matterId,
      query: userQuery,
      context,
      parameters: {
        agentType: agentConfig.agentType,
        estimatedDuration: agentConfig.estimatedDuration
      }
    };
  }

  private async executeAgent(agentType: string, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent type '${agentType}' not found`);
    }

    // Create task record
    const task = await this.taskQueue.createTask(input.matterId, agentType, input);
    
    try {
      // Update task status to running
      await this.taskQueue.updateTaskStatus(task.id, 'running');

      // Execute agent
      const result = await agent.execute(input);

      // Update task with result
      await this.taskQueue.updateTaskStatus(
        task.id, 
        result.success ? 'completed' : 'failed',
        100,
        result.result,
        result.error
      );

      return result;
    } catch (error) {
      // Update task with error
      await this.taskQueue.updateTaskStatus(
        task.id, 
        'failed',
        0,
        null,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  private async storePlan(plan: AgentOrchestrationPlan): Promise<void> {
    try {
      // TODO: Create agent_orchestrations table in schema
      // For now, skip storing orchestration plans
      console.log('Orchestration plan created:', plan.id);
    } catch (error) {
      console.error('Failed to store orchestration plan:', error);
    }
  }

  private async updatePlanStatus(planId: string, status: AgentOrchestrationPlan['status']): Promise<void> {
    try {
      // TODO: Update orchestration plan status in database
      console.log('Plan status updated:', planId, status);
    } catch (error) {
      console.error('Failed to update plan status:', error);
    }
  }

  async cancelOrchestration(planId: string): Promise<void> {
    const controller = this.runningOrchestrations.get(planId);
    if (controller) {
      controller.abort();
      await this.updatePlanStatus(planId, 'failed');
    }
  }

  async getOrchestrationStatus(planId: string): Promise<any> {
    try {
      // TODO: Implement orchestration status tracking
      return { id: planId, status: 'unknown' };
    } catch (error) {
      console.error('Failed to get orchestration status:', error);
      return null;
    }
  }

  async getMatterOrchestrations(matterId: string): Promise<any[]> {
    try {
      // TODO: Implement matter orchestration history
      return [];
    } catch (error) {
      console.error('Failed to get matter orchestrations:', error);
      return [];
    }
  }

  getAvailableAgents(): LegalAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentType: string): LegalAgent | undefined {
    return this.agents.get(agentType);
  }

  async executeDirectly(agentType: string, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      throw new Error(`Agent type '${agentType}' not found`);
    }

    return await agent.execute(input);
  }

  async createSimpleTask(
    matterId: string | null,
    agentType: string,
    query: string,
    parameters?: Record<string, any>
  ): Promise<AgentTask> {
    const input: AgentInput = {
      matterId,
      query,
      parameters
    };

    return await this.taskQueue.createTask(matterId, agentType, input, `${agentType}: ${query}`);
  }

  async executeTask(taskId: string): Promise<AgentOutput> {
    const task = await this.taskQueue.getTask(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const agent = this.agents.get(task.agentType);
    if (!agent) {
      throw new Error(`Agent type '${task.agentType}' not found`);
    }

    try {
      await this.taskQueue.updateTaskStatus(taskId, 'running');
      
      // Add task_id to context for execution tracking
      const inputWithContext = {
        ...task.input,
        context: {
          ...task.input.context,
          task_id: taskId
        }
      };
      
      const result = await agent.execute(inputWithContext);
      
      await this.taskQueue.updateTaskStatus(
        taskId,
        result.success ? 'completed' : 'failed',
        100,
        result.result,
        result.error
      );

      return result;
    } catch (error) {
      await this.taskQueue.updateTaskStatus(
        taskId,
        'failed',
        0,
        null,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

}