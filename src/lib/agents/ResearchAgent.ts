import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability, Citation } from './types';
import { CourtListenerAPI } from '@/lib/integrations/courtlistener';
import { searchSearxng } from '@/lib/searxng';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { v4 as uuidv4 } from 'uuid';

export class ResearchAgent extends BaseAgent {
  id = 'research-agent';
  type = 'research' as const;
  name = 'Legal Research Agent';
  description = 'Comprehensive legal research using case law databases, statutes, and web sources';
  
  capabilities: AgentCapability[] = [
    {
      name: 'Case Law Search',
      description: 'Search federal and state cases using CourtListener',
      inputTypes: ['query', 'jurisdiction', 'date_range'],
      outputTypes: ['cases', 'citations', 'analysis'],
      estimatedDuration: 45
    },
    {
      name: 'Statutory Research',
      description: 'Research statutes and regulations',
      inputTypes: ['query', 'jurisdiction', 'code_section'],
      outputTypes: ['statutes', 'regulations', 'analysis'],
      estimatedDuration: 30
    },
    {
      name: 'Cross-Reference Analysis',
      description: 'Find related cases and legal precedents',
      inputTypes: ['base_case', 'legal_issue'],
      outputTypes: ['related_cases', 'precedent_chain', 'analysis'],
      estimatedDuration: 60
    },
    {
      name: 'Legal Concept Research',
      description: 'Deep dive into specific legal concepts and doctrines',
      inputTypes: ['concept', 'jurisdiction'],
      outputTypes: ['concept_analysis', 'key_cases', 'trends'],
      estimatedDuration: 90
    }
  ];

  requiredContext = [];

  private courtListener = new CourtListenerAPI();
  private llm: BaseChatModel | null = null;
  private strParser = new StringOutputParser();

  constructor() {
    super();
    this.initializeLLM();
  }

  private async initializeLLM() {
    try {
      this.llm = await getDefaultChatModel();
      if (this.llm && 'temperature' in this.llm) {
        (this.llm as any).temperature = 0.1; // Low temperature for factual research
      }
    } catch (error) {
      console.error('Failed to initialize LLM for ResearchAgent:', error);
    }
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    
    try {
      if (!this.validateInput(input)) {
        return {
          success: false,
          result: null,
          error: 'Invalid input parameters'
        };
      }

      const taskId = input.context?.task_id || uuidv4();
      const executionId = await this.createExecution(taskId, input);
      
      // Check for exact cache match first
      await this.logExecution(taskId, 'Checking for cached research results', 5);
      const exactMatch = await this.getExactCacheMatch(input.query, input.matterId, input.parameters);
      
      if (exactMatch) {
        console.log('🎯 Found exact cache match for research query');
        await this.logExecution(taskId, 'Using cached research results', 100);
        
        const output: AgentOutput = {
          success: true,
          result: {
            ...exactMatch.result_data,
            cached: true,
            cacheInfo: {
              originalQuery: exactMatch.metadata?.originalQuery,
              cachedAt: exactMatch.created_at,
              usageCount: exactMatch.usage_count
            }
          },
          citations: exactMatch.result_data.citations || [],
          metadata: {
            cached: true,
            originalExecutionTime: exactMatch.metadata?.executionTime,
            ...exactMatch.metadata
          },
          executionTime: Date.now() - startTime
        };
        
        await this.completeExecution(executionId, output);
        return output;
      }

      // Check for related cached results that might inform our research
      const relatedResults = await this.getCachedResults(input.matterId, {
        resultTypes: ['case_research', 'legal_analysis', 'statutory_research'],
        maxAgeHours: 72, // Look back 3 days for related research
        limit: 5
      });
      
      if (relatedResults.length > 0) {
        const relevantResults = this.assessCacheRelevance(relatedResults, input.query);
        console.log(`💡 Found ${relevantResults.length} related cached results to inform research`);
      }
      
      // Step 1: Analyze query and extract legal concepts using AI
      await this.logExecution(taskId, 'Analyzing query and extracting legal concepts', 10);
      const legalConcepts = await this.extractLegalConceptsWithAI(input.query);
      const researchPlan = await this.createResearchPlan(input.query, legalConcepts, input.parameters);

      // Step 2: Execute case law search
      await this.logExecution(taskId, 'Searching case law databases', 30);
      const caseResults = await this.searchCaseLaw(input.query, input.parameters);

      // Step 3: Conduct statutory research
      await this.logExecution(taskId, 'Researching statutes and regulations', 50);
      const statuteResults = await this.searchStatutes(input.query, input.parameters);

      // Step 4: Perform web research for additional context
      await this.logExecution(taskId, 'Gathering additional legal context from web sources', 70);
      const webResults = await this.searchWebLegal(input.query, input.parameters);

      // Step 5: Synthesize findings using AI analysis
      await this.logExecution(taskId, 'Synthesizing research findings', 90);
      const synthesis = await this.synthesizeFindingsWithAI(caseResults, statuteResults, webResults, input.query);

      // Step 6: Generate comprehensive report
      await this.logExecution(taskId, 'Generating research report', 95);
      const report = await this.generateResearchReport(synthesis, input.matterId);

      const output: AgentOutput = {
        success: true,
        result: {
          researchPlan,
          caseResults,
          statuteResults,
          webResults,
          synthesis,
          report,
          legalConcepts,
          summary: synthesis.summary
        },
        citations: [
          ...caseResults.citations,
          ...statuteResults.citations,
          ...webResults.citations
        ],
        metadata: {
          totalCases: caseResults.cases.length,
          totalStatutes: statuteResults.statutes.length,
          totalWebSources: webResults.sources.length,
          conceptsIdentified: legalConcepts.length,
          executionId,
          executionTime: Date.now() - startTime
        },
        executionTime: Date.now() - startTime
      };

      // Cache the research results for other agents to use
      await this.logExecution(taskId, 'Caching research results for future use', 98);
      const cacheableResult = {
        type: 'legal_research',
        title: `Legal Research: ${input.query.substring(0, 100)}${input.query.length > 100 ? '...' : ''}`,
        summary: synthesis.summary || `Research findings on ${input.query}`,
        data: output.result,
        metadata: {
          confidence: 0.9,
          sourceCount: (caseResults.cases?.length || 0) + (statuteResults.statutes?.length || 0),
          conceptsCount: legalConcepts.length,
          executionTime: output.executionTime
        },
        expirationHours: 48 // Research stays fresh for 2 days
      };

      await this.cacheResult(input.matterId, input.query, cacheableResult, input.parameters);

      await this.completeExecution(executionId, output);
      return output;

    } catch (error) {
      const output: AgentOutput = {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - startTime
      };

      return output;
    }
  }

  private async createResearchPlan(
    query: string, 
    concepts: any, 
    parameters?: Record<string, any>
  ): Promise<any> {
    const searchStrategy = await this.determineSearchStrategyWithAI(query, concepts);
    
    return {
      query,
      concepts,
      searchStrategy,
      jurisdiction: parameters?.jurisdiction || 'federal',
      dateRange: parameters?.dateRange,
      priority: parameters?.priority || 'comprehensive',
      estimatedDuration: this.estimateDuration({ query, parameters } as AgentInput)
    };
  }

  private async extractLegalConceptsWithAI(query: string): Promise<any> {
    if (!this.llm) {
      // Fallback to basic concept extraction
      return this.extractLegalConceptsBasic(query);
    }

    const conceptPrompt = PromptTemplate.fromTemplate(`
You are a legal research specialist. Analyze the following legal query and extract key legal concepts.

Query: {query}

Extract and return the following in JSON format:
{{
  "primaryLegalIssues": ["list of main legal issues"],
  "secondaryIssues": ["list of related legal issues"],
  "jurisdiction": "inferred jurisdiction (federal, state, or unknown)",
  "practiceAreas": ["relevant practice areas"],
  "keyTerms": ["important legal terms and concepts"],
  "searchQueries": ["optimized search queries for case law"],
  "researchPriority": "high|medium|low"
}}

Focus on extracting actionable legal concepts that will help in case law and statutory research.`);

    try {
      const chain = conceptPrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({ query });
      
      // Parse JSON response
      const cleanResult = result.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleanResult);
    } catch (error) {
      console.error('AI concept extraction failed:', error);
      return this.extractLegalConceptsBasic(query);
    }
  }

  private extractLegalConceptsBasic(query: string): any {
    // Fallback basic extraction
    const legalTerms = ['contract', 'tort', 'negligence', 'jurisdiction', 'damages', 'liability', 'constitutional', 'criminal', 'civil'];
    const foundTerms = legalTerms.filter(term => query.toLowerCase().includes(term));
    
    return {
      primaryLegalIssues: foundTerms.slice(0, 3),
      secondaryIssues: [],
      jurisdiction: 'unknown',
      practiceAreas: foundTerms,
      keyTerms: foundTerms,
      searchQueries: [query],
      researchPriority: 'medium'
    };
  }

  private async determineSearchStrategyWithAI(query: string, concepts: any): Promise<string> {
    if (!this.llm) {
      return 'comprehensive';
    }

    const strategyPrompt = PromptTemplate.fromTemplate(`
Based on the legal query and extracted concepts, determine the optimal research strategy.

Query: {query}
Concepts: {concepts}

Choose the most appropriate strategy:
1. procedural_focused - For procedural motions, jurisdiction, venue issues
2. substantive_liability - For liability, damages, breach of contract issues
3. constitutional_analysis - For constitutional law issues
4. statutory_interpretation - For statute interpretation and regulatory issues
5. comprehensive - For complex multi-faceted legal issues

Return only the strategy name.`);

    try {
      const chain = strategyPrompt.pipe(this.llm).pipe(this.strParser);
      const strategy = await chain.invoke({ 
        query, 
        concepts: JSON.stringify(concepts) 
      });
      
      return strategy.trim();
    } catch (error) {
      console.error('AI strategy determination failed:', error);
      return 'comprehensive';
    }
  }

  private async searchCaseLaw(query: string, parameters?: Record<string, any>): Promise<any> {
    try {
      // Optimize search query using AI
      const optimizedQuery = await this.optimizeCaseSearchQuery(query);
      
      const searchOptions = {
        court: parameters?.court,
        dateAfter: parameters?.dateRange?.start,
        dateBefore: parameters?.dateRange?.end,
        order_by: '-score'
      };

      const results = await this.courtListener.searchOpinions(optimizedQuery, searchOptions);
      
      const cases = results.results || [];
      const citations: Citation[] = cases.map((caseItem: any) => {
        // Ensure URL always points to CourtListener website
        let url = caseItem.absolute_url;
        if (!url || !url.startsWith('http')) {
          url = `https://www.courtlistener.com/opinion/${caseItem.id}/`;
        }
        
        return {
          id: caseItem.id.toString(),
          type: 'case' as const,
          title: caseItem.case_name,
          citation: caseItem.citation?.neutral || caseItem.citation?.federal || caseItem.citation?.state,
          court: caseItem.court,
          date: caseItem.date_filed,
          url: url,
          relevance: caseItem.score
        };
      });

      // Store cases in database for future reference
      await this.storeCasesInDB(cases);

      return {
        cases,
        citations,
        totalResults: results.count,
        strategy: 'case_law_search'
      };
    } catch (error) {
      console.error('Case law search failed:', error);
      return {
        cases: [],
        citations: [],
        totalResults: 0,
        error: error instanceof Error ? error.message : 'Case law search failed'
      };
    }
  }

  private async searchStatutes(query: string, parameters?: Record<string, any>): Promise<any> {
    // Optimize statutory search using AI
    const optimizedQuery = await this.optimizeStatutorySearchQuery(query);
    
    try {
      const results = await searchSearxng(optimizedQuery, {
        categories: ['general'],
        engines: ['google', 'bing']
      });

      const statutes = results.results
        .filter((result: any) => 
          result.url.includes('uscode') || 
          result.url.includes('law.cornell.edu') ||
          result.url.includes('govinfo.gov') ||
          result.title.toLowerCase().includes('statute') ||
          result.title.toLowerCase().includes('code')
        )
        .slice(0, 10);

      const citations: Citation[] = statutes.map((statute: any, index: number) => ({
        id: `statute-${index}`,
        type: 'statute' as const,
        title: statute.title,
        url: statute.url,
        relevance: 1 - (index * 0.1)
      }));

      return {
        statutes,
        citations,
        totalResults: statutes.length,
        strategy: 'statutory_search'
      };
    } catch (error) {
      console.error('Statute search failed:', error);
      // Return fallback statutory information based on common legal principles
      return this.generateStatutoryFallback(query);
    }
  }

  private async searchWebLegal(query: string, parameters?: Record<string, any>): Promise<any> {
    // Optimize web legal search using AI
    const optimizedQuery = await this.optimizeLegalWebSearchQuery(query);
    
    try {
      const results = await searchSearxng(optimizedQuery, {
        categories: ['general'],
        engines: ['google', 'bing', 'scholar']
      });

      const sources = results.results
        .filter((result: any) => 
          result.url.includes('ssrn.com') ||
          result.url.includes('heinonline.org') ||
          result.url.includes('westlaw.com') ||
          result.url.includes('lexisnexis.com') ||
          result.url.includes('scholar.google.com') ||
          result.title.toLowerCase().includes('law review') ||
          result.content?.toLowerCase().includes('legal analysis')
        )
        .slice(0, 15);

      const citations: Citation[] = sources.map((source: any, index: number) => ({
        id: `web-${index}`,
        type: 'web' as const,
        title: source.title,
        url: source.url,
        relevance: 1 - (index * 0.05)
      }));

      return {
        sources,
        citations,
        totalResults: sources.length,
        strategy: 'web_legal_search'
      };
    } catch (error) {
      console.error('Web legal search failed:', error);
      // Return fallback web information based on legal query
      return this.generateWebFallback(query);
    }
  }

  private async synthesizeFindingsWithAI(
    caseResults: any,
    statuteResults: any,
    webResults: any,
    query: string
  ): Promise<any> {
    if (!this.llm) {
      return this.synthesizeFindingsBasic(caseResults, statuteResults, webResults, query);
    }

    const synthesisPrompt = PromptTemplate.fromTemplate(`
You are an expert legal research analyst. Synthesize the following research findings into a comprehensive, professional-grade legal analysis.

Original Query: {query}

Case Law Results: {caseResults}
Statutory Results: {statuteResults}
Web/Secondary Sources: {webResults}

Provide a detailed, structured analysis in JSON format. Use your legal expertise to provide thorough analysis:

{{
  "executiveSummary": "Comprehensive overview of key legal findings and their significance",
  "primaryAuthorities": [
    {{
      "type": "case|statute|regulation",
      "title": "Full title/name with proper citation",
      "significance": "Detailed explanation of legal significance and precedential value",
      "citation": "Complete legal citation in proper format",
      "keyHolding": "The key legal principle or rule established",
      "applicability": "How this applies to the original query"
    }}
  ],
  "legalAnalysis": "In-depth legal analysis including:\n- Legal standards and tests\n- Element-by-element analysis\n- Jurisdictional considerations\n- Policy rationales\n- Practical implications\n- Potential counterarguments",
  "distinctions": "Important factual or legal distinctions that affect application",
  "practicalGuidance": "Specific, actionable guidance for practitioners",
  "gaps": ["Areas requiring additional research with specific recommendations"],
  "recommendations": ["Detailed next steps for further research or legal strategy"],
  "confidence": "high|medium|low - with explanation of assessment basis",
  "jurisdictionalNotes": "Important jurisdictional variations or conflicts",
  "recentDevelopments": "Any recent legal developments that may affect analysis"
}}

Prioritize accuracy, depth of analysis, and practical application. Consider both federal and state law implications where relevant.`);

    try {
      // With GPT-4o's larger context window, we can use more complete data
      const processedCaseResults = {
        cases: caseResults.cases?.slice(0, 10).map((c: any) => ({
          case_name: c.case_name,
          court: c.court,
          date: c.date,
          citation: c.citation,
          summary: c.summary?.substring(0, 500) // Increased from 200 to 500
        })) || [],
        totalResults: caseResults.totalResults || 0,
        strategy: caseResults.strategy
      };
      
      const processedStatuteResults = {
        statutes: statuteResults.statutes?.slice(0, 10).map((s: any) => ({
          title: s.title,
          url: s.url,
          content: s.content?.substring(0, 500) // Increased from 200 to 500
        })) || [],
        totalResults: statuteResults.totalResults || 0,
        strategy: statuteResults.strategy
      };
      
      const processedWebResults = {
        sources: webResults.sources?.slice(0, 10).map((w: any) => ({
          title: w.title,
          url: w.url,
          content: w.content?.substring(0, 500) // Increased from 200 to 500
        })) || [],
        totalResults: webResults.totalResults || 0,
        strategy: webResults.strategy
      };

      const chain = synthesisPrompt.pipe(this.llm).pipe(this.strParser);
      const result = await chain.invoke({
        query,
        caseResults: JSON.stringify(processedCaseResults, null, 2),
        statuteResults: JSON.stringify(processedStatuteResults, null, 2),
        webResults: JSON.stringify(processedWebResults, null, 2)
      });
      
      const cleanResult = result.replace(/```json\n?|```/g, '').trim();
      const synthesis = JSON.parse(cleanResult);
      
      return {
        query,
        ...synthesis,
        timestamp: new Date().toISOString(),
        totalSources: {
          cases: caseResults.cases?.length || 0,
          statutes: statuteResults.statutes?.length || 0,
          webSources: webResults.sources?.length || 0
        }
      };
    } catch (error) {
      console.error('AI synthesis failed:', error);
      return this.synthesizeFindingsBasic(caseResults, statuteResults, webResults, query);
    }
  }

  private synthesizeFindingsBasic(
    caseResults: any,
    statuteResults: any,
    webResults: any,
    query: string
  ): any {
    const keyFindings = [];
    
    // Analyze case law findings
    if (caseResults.cases?.length > 0) {
      const topCases = caseResults.cases.slice(0, 5);
      keyFindings.push({
        type: 'case_law',
        summary: `Found ${caseResults.cases.length} relevant cases`,
        keyPoints: topCases.map((caseItem: any) => ({
          case: caseItem.case_name,
          court: caseItem.court,
          relevance: caseItem.score,
          citation: caseItem.citation?.neutral || caseItem.citation?.federal
        }))
      });
    }

    // Analyze statutory findings
    if (statuteResults.statutes?.length > 0) {
      keyFindings.push({
        type: 'statutory',
        summary: `Found ${statuteResults.statutes.length} relevant statutes and regulations`,
        keyPoints: statuteResults.statutes.slice(0, 3).map((statute: any) => ({
          title: statute.title,
          url: statute.url
        }))
      });
    }

    // Analyze web sources
    if (webResults.sources?.length > 0) {
      keyFindings.push({
        type: 'secondary_authority',
        summary: `Found ${webResults.sources.length} secondary sources and analyses`,
        keyPoints: webResults.sources.slice(0, 3).map((source: any) => ({
          title: source.title,
          url: source.url
        }))
      });
    }

    return {
      query,
      keyFindings,
      executiveSummary: `Research completed on "${query}". Found ${caseResults.cases?.length || 0} cases, ${statuteResults.statutes?.length || 0} statutes, and ${webResults.sources?.length || 0} secondary sources.`,
      recommendations: this.generateRecommendations(keyFindings),
      confidence: 'medium',
      timestamp: new Date().toISOString()
    };
  }

  private generateRecommendations(findings: any[]): string[] {
    const recommendations = [];
    
    if (findings.some(f => f.type === 'case_law')) {
      recommendations.push('Review the most recent and highest-ranked cases for current legal standards');
    }
    
    if (findings.some(f => f.type === 'statutory')) {
      recommendations.push('Verify current status of statutes and check for recent amendments');
    }
    
    if (findings.length > 1) {
      recommendations.push('Cross-reference findings between primary and secondary authorities');
    }
    
    recommendations.push('Consider jurisdiction-specific variations in law');
    recommendations.push('Check for pending appeals or recent developments');
    
    return recommendations;
  }

  private async generateResearchReport(synthesis: any, matterId: string | null): Promise<string> {
    const matter = await this.getMatterInfo(matterId);
    
    if (!this.llm) {
      return this.generateBasicReport(synthesis, matter);
    }

    const reportPrompt = PromptTemplate.fromTemplate(`
Generate a professional legal research memorandum based on the following synthesis.

Matter: {matterName}
Query: {query}
Synthesis: {synthesis}

Create a formal legal research memo with:
1. Header with matter info and date
2. Executive Summary
3. Legal Analysis section
4. Primary Authorities section
5. Recommendations section
6. Areas for Additional Research

Use proper legal memo formatting and professional tone.`);

    try {
      const chain = reportPrompt.pipe(this.llm).pipe(this.strParser);
      const report = await chain.invoke({
        matterName: matter?.name || 'Unknown Matter',
        query: synthesis.query,
        synthesis: JSON.stringify(synthesis, null, 2)
      });
      
      return report + `\n\n---\n*Generated by BenchWise Legal Research Agent*\n*Timestamp: ${synthesis.timestamp}*`;
    } catch (error) {
      console.error('AI report generation failed:', error);
      return this.generateBasicReport(synthesis, matter);
    }
  }

  private generateBasicReport(synthesis: any, matter: any): string {
    return `# Legal Research Report

## Matter: ${matter?.name || 'Unknown Matter'}
**Date:** ${new Date().toLocaleDateString()}
**Research Query:** ${synthesis.query}

## Executive Summary
${synthesis.executiveSummary || synthesis.summary}

## Legal Analysis
${synthesis.legalAnalysis || 'Analysis pending AI integration.'}

## Primary Authorities
${synthesis.primaryAuthorities?.map((auth: any) => `
### ${auth.title}
**Citation:** ${auth.citation}
**Significance:** ${auth.significance}
`).join('') || 'No primary authorities identified.'}

## Recommendations
${synthesis.recommendations?.map((rec: string) => `- ${rec}`).join('\n') || 'No specific recommendations at this time.'}

## Areas for Additional Research
${synthesis.gaps?.map((gap: string) => `- ${gap}`).join('\n') || 'No research gaps identified.'}

---
*Generated by BenchWise Legal Research Agent*
*Timestamp: ${synthesis.timestamp}*`;
  }

  private async storeCasesInDB(cases: any[]): Promise<void> {
    try {
      const caseData = cases.map(caseItem => ({
        case_name: caseItem.case_name,
        citation: caseItem.citation?.neutral || caseItem.citation?.federal || caseItem.citation?.state,
        court: caseItem.court,
        decision_date: caseItem.date_filed,
        courtlistener_id: caseItem.id.toString(),
        full_text: caseItem.text || null,
        metadata: {
          score: caseItem.score,
          docket_id: caseItem.docket,
          absolute_url: caseItem.absolute_url
        }
      }));

      await this.supabase
        .from('case_citations')
        .upsert(caseData, { onConflict: 'courtlistener_id' });
    } catch (error) {
      console.error('Failed to store cases in database:', error);
    }
  }

  private async optimizeCaseSearchQuery(query: string): Promise<string> {
    if (!this.llm) {
      return query; // Return original if no AI available
    }

    const caseSearchPrompt = PromptTemplate.fromTemplate(`
Optimize this legal query for case law database search (CourtListener).

Original Query: {query}

Generate an optimized search query that:
1. Uses legal terminology and concepts
2. Focuses on key legal issues
3. Removes unnecessary words
4. Uses appropriate Boolean operators if needed

Return only the optimized query string.`);

    try {
      const chain = caseSearchPrompt.pipe(this.llm).pipe(this.strParser);
      const optimized = await chain.invoke({ query });
      return optimized.trim();
    } catch (error) {
      console.error('Query optimization failed:', error);
      return query;
    }
  }

  private async optimizeStatutorySearchQuery(query: string): Promise<string> {
    if (!this.llm) {
      return `"${query}" statute law code regulation USC CFR`;
    }

    const statutePrompt = PromptTemplate.fromTemplate(`
Optimize this query for finding relevant statutes and regulations.

Original Query: {query}

Generate a search query that includes:
1. Core legal concepts from the query
2. Relevant statutory terms (statute, code, regulation, USC, CFR)
3. Appropriate quotation marks for exact phrases

Return only the optimized search string.`);

    try {
      const chain = statutePrompt.pipe(this.llm).pipe(this.strParser);
      const optimized = await chain.invoke({ query });
      return optimized.trim();
    } catch (error) {
      console.error('Statutory query optimization failed:', error);
      return `"${query}" statute law code regulation USC CFR`;
    }
  }

  private async optimizeLegalWebSearchQuery(query: string): Promise<string> {
    if (!this.llm) {
      return `"${query}" legal analysis law review article`;
    }

    const webPrompt = PromptTemplate.fromTemplate(`
Optimize this query for finding legal secondary sources and analyses.

Original Query: {query}

Generate a search query optimized for finding:
1. Law review articles
2. Legal analyses
3. Court commentary
4. Legal databases (SSRN, HeinOnline, etc.)

Return only the optimized search string.`);

    try {
      const chain = webPrompt.pipe(this.llm).pipe(this.strParser);
      const optimized = await chain.invoke({ query });
      return optimized.trim();
    } catch (error) {
      console.error('Web query optimization failed:', error);
      return `"${query}" legal analysis law review article`;
    }
  }

  estimateDuration(input: AgentInput): number {
    const baseTime = 60; // 1 minute base
    const complexityFactor = input.query.length > 100 ? 2 : 1;
    const parameterFactor = Object.keys(input.parameters || {}).length * 0.5;
    
    return Math.round(baseTime * complexityFactor * (1 + parameterFactor));
  }

  private generateStatutoryFallback(query: string): any {
    // Generate relevant statutory guidance based on common queries
    const lowerQuery = query.toLowerCase();
    const statutes = [];

    if (lowerQuery.includes('murder') || lowerQuery.includes('homicide')) {
      statutes.push({
        title: 'Colorado Revised Statutes § 18-3-102 - Murder in the first degree',
        url: 'https://law.justia.com/codes/colorado/2016/title-18/article-3/section-18-3-102/',
        content: 'First degree murder requires premeditation and intent to cause death'
      });
      statutes.push({
        title: 'Colorado Revised Statutes § 18-3-103 - Murder in the second degree', 
        url: 'https://law.justia.com/codes/colorado/2016/title-18/article-3/section-18-3-103/',
        content: 'Second degree murder involves knowingly causing death without premeditation'
      });
    }

    return {
      statutes,
      citations: statutes.map((s, i) => ({
        id: `fallback-statute-${i}`,
        type: 'statute' as const,
        title: s.title,
        url: s.url,
        relevance: 0.8
      })),
      totalResults: statutes.length,
      strategy: 'fallback_statutory',
      note: 'Limited results - external search unavailable'
    };
  }

  private generateWebFallback(query: string): any {
    // Generate relevant web source guidance based on common queries  
    const lowerQuery = query.toLowerCase();
    const sources = [];

    if (lowerQuery.includes('murder') || lowerQuery.includes('homicide')) {
      sources.push({
        title: 'Understanding Degrees of Murder in Colorado Law',
        url: 'https://www.shouselaw.com/co/defense/crimes/murder/',
        content: 'Legal analysis of first and second degree murder distinctions in Colorado'
      });
    }

    return {
      sources,
      citations: sources.map((s, i) => ({
        id: `fallback-web-${i}`,
        type: 'web' as const,
        title: s.title,
        url: s.url,
        relevance: 0.7
      })),
      totalResults: sources.length,
      strategy: 'fallback_web',
      note: 'Limited results - external search unavailable'
    };
  }
}