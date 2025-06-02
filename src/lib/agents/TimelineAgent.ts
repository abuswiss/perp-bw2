import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability, Citation } from './types';
import { TimelineNLPProcessor } from './timeline/NLPProcessor';
import { TimelineGenerator } from './timeline/TimelineGenerator';
import { 
  LitigationTimeline, 
  TimelineAnalysis, 
  Recommendations,
  CaseType 
} from './timeline/types';
import { v4 as uuidv4 } from 'uuid';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { z } from 'zod';

// Define schema for timeline agent input/output
const TimelineAgentInputSchema = z.object({
  query: z.string(),
  matterId: z.string().nullable(),
  parameters: z.record(z.any()).optional(),
  context: z.record(z.any()).optional(),
  documents: z.array(z.any()).optional()
});

const TimelineAgentOutputSchema = z.object({
  success: z.boolean(),
  result: z.object({
    timeline: z.any(), // LitigationTimeline type
    analysis: z.any(), // TimelineAnalysis type
    recommendations: z.any(), // Recommendations type
    visualizationData: z.any().optional()
  }).nullable(),
  error: z.string().optional(),
  citations: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  executionTime: z.number().optional()
});

export class TimelineAgent extends BaseAgent {
  id = 'timeline-agent';
  type = 'analysis' as const;
  name = 'Legal Timeline Generator';
  description = 'Generates comprehensive litigation timelines from natural language descriptions';

  capabilities: AgentCapability[] = [
    {
      name: 'Case Type Classification',
      description: 'Identify legal issue type and complexity from natural language',
      inputTypes: ['natural_language', 'matter_context'],
      outputTypes: ['case_classification', 'complexity_assessment'],
      estimatedDuration: 15
    },
    {
      name: 'Timeline Generation',
      description: 'Create customized litigation timeline with phases and costs',
      inputTypes: ['case_type', 'jurisdiction', 'complexity'],
      outputTypes: ['timeline_phases', 'cost_estimates', 'duration_estimates'],
      estimatedDuration: 30
    },
    {
      name: 'Risk Assessment',
      description: 'Analyze case risks and settlement probabilities',
      inputTypes: ['case_facts', 'case_type'],
      outputTypes: ['risk_factors', 'settlement_probability'],
      estimatedDuration: 20
    },
    {
      name: 'Next Steps Generation',
      description: 'Generate actionable immediate and long-term steps',
      inputTypes: ['case_type', 'urgency_factors'],
      outputTypes: ['immediate_actions', 'preparation_steps'],
      estimatedDuration: 15
    }
  ];

  requiredContext = []; // No specific context required

  private nlpProcessor: TimelineNLPProcessor;
  private timelineGenerator: TimelineGenerator;
  private llm: BaseChatModel | null = null;
  private strParser = new StringOutputParser();

  constructor() {
    super();
    this.nlpProcessor = new TimelineNLPProcessor();
    this.timelineGenerator = new TimelineGenerator();
    this.initializeLLM();
  }

  protected getInputSchema() {
    return TimelineAgentInputSchema;
  }

  protected getOutputSchema() {
    return TimelineAgentOutputSchema;
  }

  private async initializeLLM() {
    try {
      this.llm = await getDefaultChatModel();
      if (this.llm && 'temperature' in this.llm) {
        (this.llm as any).temperature = 0.1; // Low temperature for consistency
      }
    } catch (error) {
      console.error('Failed to initialize LLM for TimelineAgent:', error);
    }
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();

    try {
      // Validate input
      if (!this.validateInput(input)) {
        return {
          success: false,
          result: null,
          error: 'Invalid input: query is required'
        };
      }

      const taskId = input.context?.task_id || uuidv4();
      const executionId = await this.createExecution(taskId, input);

      // Step 1: Analyze natural language input
      await this.logExecution(taskId, 'Analyzing case description', 20);
      const classification = await this.nlpProcessor.classifyCaseType(input.query);
      const entities = await this.nlpProcessor.extractEntities(input.query);
      
      // Step 2: Assess complexity
      await this.logExecution(taskId, 'Assessing case complexity', 40);
      const complexity = await this.nlpProcessor.assessComplexity(input.query, classification);
      const urgency = await this.nlpProcessor.assessUrgency(input.query, entities);
      const customFactors = await this.nlpProcessor.identifyCustomFactors(input.query);

      // Step 3: Generate timeline
      await this.logExecution(taskId, 'Generating litigation timeline', 60);
      const timeline = await this.timelineGenerator.generateTimeline(
        classification.primaryType,
        entities.jurisdiction.state || input.parameters?.jurisdiction,
        complexity,
        classification
      );

      // Step 4: Generate AI-powered recommendations
      await this.logExecution(taskId, 'Creating recommendations', 80);
      const analysis: TimelineAnalysis = {
        classification,
        entities,
        complexity,
        urgency,
        customFactors
      };
      
      const recommendations = await this.generateRecommendations(analysis, timeline);

      // Step 5: Create visualization data
      const visualizationData = this.createVisualizationData(timeline);

      // Create output
      const output: AgentOutput = {
        success: true,
        result: {
          timeline,
          analysis,
          recommendations,
          visualizationData
        },
        citations: this.generateCitations(timeline),
        metadata: {
          executionId,
          caseType: classification.primaryType,
          complexity: complexity.level,
          jurisdiction: entities.jurisdiction.state || 'general',
          urgencyLevel: urgency.level,
          processingTime: Date.now() - startTime
        },
        executionTime: Date.now() - startTime
      };

      await this.completeExecution(executionId, output);
      return output;

    } catch (error) {
      console.error('Timeline generation failed:', error);
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Timeline generation failed',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async generateRecommendations(
    analysis: TimelineAnalysis,
    timeline: LitigationTimeline
  ): Promise<Recommendations> {
    if (!this.llm) {
      return this.generateBasicRecommendations(analysis, timeline);
    }

    const recommendationPrompt = PromptTemplate.fromTemplate(`
You are an experienced litigation attorney providing strategic recommendations.

Case Analysis:
- Type: {caseType}
- Complexity: {complexity}
- Urgency: {urgency}
- Special Factors: {specialFactors}
- Estimated Duration: {duration}
- Estimated Cost: {costRange}

Timeline Summary:
{timelineSummary}

Provide strategic recommendations including:
1. Primary recommendation (pursue litigation, settle, or alternative approach)
2. Key risk factors to monitor
3. Critical deadlines and statutes of limitations
4. Cost-saving opportunities
5. Alternative dispute resolution options and when to pursue them

Be specific and practical. Consider the client's likely goals and resources.

Return a JSON object with:
{{
  "primary": "Main strategic recommendation",
  "riskFactors": ["List of key risks to monitor"],
  "criticalDeadlines": [{{"description": "deadline", "daysFromNow": 180, "type": "filing", "isCritical": true}}],
  "costSavingOpportunities": ["List of ways to reduce costs"],
  "alternativeDisputes": [{{"type": "mediation", "description": "when and why to consider", "estimatedCost": "cost range", "estimatedDuration": "time", "successRate": 0.7, "whenToConsider": "timing"}}]
}}
`);

    try {
      const chain = recommendationPrompt.pipe(this.llm).pipe(this.strParser);
      const response = await chain.invoke({
        caseType: analysis.classification.primaryType,
        complexity: JSON.stringify(analysis.complexity),
        urgency: JSON.stringify(analysis.urgency),
        specialFactors: analysis.customFactors.join(', '),
        duration: `${timeline.totalDuration.typical} ${timeline.totalDuration.unit}`,
        costRange: `$${timeline.totalCost.min.toLocaleString()} - $${timeline.totalCost.max.toLocaleString()}`,
        timelineSummary: this.summarizeTimeline(timeline)
      });

      const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Recommendation generation failed:', error);
      return this.generateBasicRecommendations(analysis, timeline);
    }
  }

  private generateBasicRecommendations(
    analysis: TimelineAnalysis,
    timeline: LitigationTimeline
  ): Recommendations {
    const recommendations: Recommendations = {
      primary: timeline.summary.primaryRecommendation,
      riskFactors: timeline.riskFactors.map(r => r.description),
      criticalDeadlines: timeline.criticalDeadlines,
      costSavingOpportunities: [],
      alternativeDisputes: timeline.alternativeDisputes
    };

    // Add basic cost-saving opportunities
    if (timeline.totalCost.max > 25000) {
      recommendations.costSavingOpportunities.push(
        'Consider early mediation to avoid discovery costs',
        'Limit depositions to key witnesses only',
        'Use written discovery strategically'
      );
    }

    if (analysis.complexity.level === 'simple') {
      recommendations.costSavingOpportunities.push(
        'Consider handling in small claims court if damages allow',
        'Explore direct negotiation before formal proceedings'
      );
    }

    return recommendations;
  }

  private summarizeTimeline(timeline: LitigationTimeline): string {
    const phases = timeline.phases.map(p => 
      `${p.name} (${p.duration.typical} ${p.duration.unit}, $${p.costRange.min}-$${p.costRange.max})`
    ).join('\n');

    return `Total Duration: ${timeline.totalDuration.typical} ${timeline.totalDuration.unit}
Total Cost: $${timeline.totalCost.min.toLocaleString()}-$${timeline.totalCost.max.toLocaleString()}
Settlement opportunities at: ${timeline.phases.filter(p => p.settlementProbability > 0.5).map(p => p.name).join(', ')}

Phases:
${phases}`;
  }

  private createVisualizationData(timeline: LitigationTimeline): any {
    // Create data structure optimized for UI visualization
    return {
      phases: timeline.phases.map(phase => ({
        id: phase.id,
        name: phase.name,
        startWeek: this.calculateStartWeek(timeline.phases, phase),
        duration: phase.duration.typical,
        durationUnit: phase.duration.unit,
        costMin: phase.costRange.min,
        costMax: phase.costRange.max,
        settlementProbability: phase.settlementProbability,
        hasRisks: phase.risks.length > 0,
        actionCount: phase.keyActions.length
      })),
      costProgression: this.calculateCostProgression(timeline.phases),
      settlementCurve: this.calculateSettlementCurve(timeline.phases),
      criticalPoints: timeline.criticalDeadlines.map(d => ({
        week: Math.floor((d.daysFromNow || 0) / 7),
        label: d.description,
        type: d.type
      }))
    };
  }

  private calculateStartWeek(allPhases: any[], currentPhase: any): number {
    let weeksSoFar = 0;
    for (const phase of allPhases) {
      if (phase.id === currentPhase.id) break;
      
      const weeks = phase.duration.unit === 'weeks' ? phase.duration.typical :
                   phase.duration.unit === 'months' ? phase.duration.typical * 4 :
                   phase.duration.unit === 'days' ? phase.duration.typical / 7 : 0;
      weeksSoFar += weeks;
    }
    return Math.round(weeksSoFar);
  }

  private calculateCostProgression(phases: any[]): Array<{week: number, minCost: number, maxCost: number}> {
    const progression = [];
    let week = 0;
    let minTotal = 0;
    let maxTotal = 0;

    for (const phase of phases) {
      const weeks = phase.duration.unit === 'weeks' ? phase.duration.typical :
                   phase.duration.unit === 'months' ? phase.duration.typical * 4 : 1;
      
      minTotal += phase.costRange.min;
      maxTotal += phase.costRange.max;
      
      progression.push({ week, minCost: minTotal, maxCost: maxTotal });
      week += weeks;
    }

    return progression;
  }

  private calculateSettlementCurve(phases: any[]): Array<{week: number, probability: number}> {
    const curve = [];
    let week = 0;

    for (const phase of phases) {
      const weeks = phase.duration.unit === 'weeks' ? phase.duration.typical :
                   phase.duration.unit === 'months' ? phase.duration.typical * 4 : 1;
      
      curve.push({ week, probability: phase.settlementProbability });
      week += weeks;
    }

    return curve;
  }

  private generateCitations(timeline: LitigationTimeline): Citation[] {
    // Generate citations for legal references used in timeline
    const citations: Citation[] = [];

    // Add jurisdiction-specific citations
    if (timeline.metadata.jurisdiction && timeline.metadata.jurisdiction !== 'general') {
      citations.push({
        id: 'jurisdiction-rules',
        type: 'statute' as const,
        title: `${timeline.metadata.jurisdiction} Civil Procedure Rules`,
        relevance: 0.9
      });
    }

    // Add case type specific legal references
    const caseTypeReferences: Record<CaseType, Citation> = {
      personal_injury: {
        id: 'pi-law',
        type: 'statute' as const,
        title: 'Personal Injury Statutes and Case Law',
        relevance: 0.9
      },
      employment: {
        id: 'employment-law',
        type: 'statute' as const,
        title: 'Title VII and Employment Law Statutes',
        relevance: 0.9
      },
      contract_dispute: {
        id: 'contract-law',
        type: 'statute' as const,
        title: 'Contract Law and Commercial Code',
        relevance: 0.9
      },
      landlord_tenant: {
        id: 'landlord-tenant-law',
        type: 'statute' as const,
        title: 'Landlord-Tenant Act and Housing Codes',
        relevance: 0.9
      },
      consumer_protection: {
        id: 'consumer-law',
        type: 'statute' as const,
        title: 'Consumer Protection Laws',
        relevance: 0.9
      },
      business_litigation: {
        id: 'business-law',
        type: 'statute' as const,
        title: 'Business and Commercial Law',
        relevance: 0.9
      },
      family_law: {
        id: 'family-law',
        type: 'statute' as const,
        title: 'Family Law Statutes',
        relevance: 0.9
      },
      criminal: {
        id: 'criminal-law',
        type: 'statute' as const,
        title: 'Criminal Code and Procedures',
        relevance: 0.9
      },
      other: {
        id: 'general-law',
        type: 'statute' as const,
        title: 'General Legal References',
        relevance: 0.7
      }
    };

    const caseTypeRef = caseTypeReferences[timeline.classification.primaryType];
    if (caseTypeRef) {
      citations.push(caseTypeRef);
    }

    return citations;
  }
}