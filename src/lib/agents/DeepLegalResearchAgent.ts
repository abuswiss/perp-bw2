import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability, Citation, AgentContext } from './types';
import { DeepLegalResearchAgentInputSchema, DeepLegalResearchAgentOutputSchema } from './schemas'; // Assuming these will be created
import { Document } from '@langchain/core/documents';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getDefaultChatModel } from '@/lib/providers'; // Or your specific LLM provider
import { searchSearxng } from '@/lib/searxng';
import { CourtListenerAPI } from '@/lib/integrations/courtlistener';
// Import prompts and other necessary utilities from academicSearch and ResearchAgent as needed
// For example:
// import { academicSearchRetrieverPrompt, academicSearchResponsePrompt } from '@/lib/prompts/academicSearch';
// import { MetaSearchAgent } from '@/lib/search/metaSearchAgent'; // If we adapt its engine running
// import prompts from \'@/lib/prompts\';


// Define specific capabilities for this agent
const deepLegalResearchCapabilities: AgentCapability[] = [
  {
    name: 'Comprehensive Legal Analysis',
    description: 'Performs in-depth research across case law, statutes, academic sources, and the web, followed by intelligent synthesis.',
    inputTypes: ['query', 'jurisdiction', 'legal_concepts', 'document_context'],
    outputTypes: ['detailed_analysis', 'key_findings', 'source_summary', 'citations'],
    estimatedDuration: 300 // 5 minutes, adjust as needed
  },
  {
    name: 'Academic Legal Review Synthesis',
    description: 'Focuses on finding and synthesizing academic legal literature like law reviews and scholarly articles on a specific legal topic.',
    inputTypes: ['topic', 'keywords'],
    outputTypes: ['literature_review', 'key_arguments', 'citations'],
    estimatedDuration: 240
  },
  // Potentially more granular capabilities
];

export class DeepLegalResearchAgent extends BaseAgent {
  id = 'deep-legal-research-agent';
  type = 'deepResearch' as const; // Or a new type like 'deepLegalResearch' if schema allows
  name = 'Deep Legal Research Agent';
  description = 'Conducts comprehensive, multi-vector legal research and provides intelligent analysis and synthesis.';
  capabilities = deepLegalResearchCapabilities;
  requiredContext: string[] = []; // e.g., ['matterId'] if operations are matter-specific

  private llm: BaseChatModel | null = null;
  private courtListener: CourtListenerAPI;
  // private academicSearcher: MetaSearchAgent | null = null; // Example if using MetaSearchAgent structure

  constructor() {
    super();
    this.courtListener = new CourtListenerAPI();
    this.initializeLLMAndTools();
  }

  private async initializeLLMAndTools() {
    try {
      this.llm = await getDefaultChatModel(/* pass specific model params if needed */);
      if (this.llm && 'temperature' in this.llm) {
        (this.llm as any).temperature = 0.2; // Slightly higher for synthesis, but still factual
      }
      // Initialize academic search mechanism if needed
      // this.academicSearcher = new MetaSearchAgent({
      //   activeEngines: ['google', 'bing'], // Or specific academic engines
      //   queryGeneratorPrompt: prompts.academicSearchRetrieverPrompt, // Adapt or create new
      //   responsePrompt: prompts.academicSearchResponsePrompt, // Adapt or create new
      //   searchWeb: true, // This will be for academic sites
      //   // ... other params
      // });
      console.log('DeepLegalResearchAgent LLM and tools initialized.');
    } catch (error) {
      console.error('Failed to initialize LLM or tools for DeepLegalResearchAgent:', error);
    }
  }

  protected getInputSchema() {
    return DeepLegalResearchAgentInputSchema;
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    // Validate input using Zod schema
    const parseResult = DeepLegalResearchAgentInputSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        result: null,
        error: 'Invalid input parameters: ' + JSON.stringify(parseResult.error.issues),
        executionTime: Date.now() - startTime,
      };
    }
    const { query, parameters, context, matterId } = parseResult.data;

    try {
      // 1. Advanced Query Analysis & Strategy Planning
      const researchPlan = await this.planResearchStrategy(query, parameters, context);

      // 2. Multi-Vector Search Execution
      //    - Legal databases (CourtListener)
      //    - Academic sources (adapted academic search logic)
      //    - General web (vetted legal info)
      const allSources = await this.executeMultiVectorSearch(researchPlan);

      // 3. Source Evaluation and Re-ranking
      const relevantSources = await this.evaluateAndRankSources(query, allSources, researchPlan);
      
      if (relevantSources.length === 0) {
        return {
          success: true,
          result: { response: "No relevant sources found for your query after comprehensive searching.", sources: [] },
          executionTime: Date.now() - startTime,
        };
      }

      // 4. Information Extraction (if necessary, beyond simple content)
      //    Could involve targeted questions to LLM for specific info from each source

      // 5. Intelligent Synthesis and Analysis
      const analysisResult = await this.synthesizeFindings(query, relevantSources, researchPlan, context);

      // 6. Citation Generation
      const citations = this.generateCitations(relevantSources);

      return {
        success: true,
        result: {
          response: analysisResult.synthesizedText,
          keyFindings: analysisResult.keyFindings, // (optional)
          // Add other structured outputs as defined
          sources: relevantSources,
        },
        citations,
        executionTime: Date.now() - startTime,
        // metadata could include aspects of the researchPlan or source counts
      };
    } catch (error: any) {
      console.error('Error during DeepLegalResearchAgent execution:', error);
      return {
        success: false,
        result: null,
        error: error.message || 'An unknown error occurred during deep legal research.',
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async planResearchStrategy(query: string, parameters?: Record<string, any>, agentContext?: AgentContext): Promise<any> {
    console.log('Planning research strategy for:', query, 'with params:', parameters);
    if (!this.llm) {
      console.warn('LLM not available for research planning. Using basic plan.');
      // Fallback to a very basic plan if LLM is not available
      return {
        originalQuery: query,
        analyzedQuery: query,
        targetJurisdictions: parameters?.jurisdiction ? [parameters.jurisdiction] : await this.determineJurisdictions(query, {}),
        sourceTypes: ['case_law', 'statutes', 'academic_legal', 'vetted_web_legal'],
        subQueries: {
          caseLaw: `case law related to ${query}` + (parameters?.jurisdiction ? ` in ${parameters.jurisdiction}` : ''),
          statutes: `statutes related to ${query}` + (parameters?.jurisdiction ? ` in ${parameters.jurisdiction}` : ''),
          academic: await this.generateAcademicQuery(`legal scholarship and analysis on ${query}`),
          web: `legal information and analysis on ${query}`,
        },
        maxCases: parameters?.caseLawPreferences?.maxCases || 10,
        maxStatutes: parameters?.statutePreferences?.maxStatutes || 5,
        maxAcademicArticles: parameters?.academicPreferences?.maxArticles || 5,
        maxWebSources: 5, // Default for now
        maxTotalSources: parameters?.maxTotalSources || 20,
      };
    }

    const planningPromptText = `
You are an expert legal research strategist. Given a user's query and optional parameters, create a detailed research plan.

User Query: "${query}"
Parameters: ${JSON.stringify(parameters, null, 2)}

Research Plan Requirements:
1.  **analyzedQuery**: Rephrase the user's query to be more specific and effective for legal research if necessary. If the query is already good, use it as is. Extract key legal concepts or terms.
2.  **targetJurisdictions**: Based on the query and parameters (especially parameters.jurisdiction), identify a list of specific target jurisdictions (e.g., ["scotus", "ca9", "tex"]). If no jurisdiction is obvious, use an empty array or a very broad one like ["federal"].
3.  **sourceTypes**: Determine the primary types of sources to consult. Choose from: "case_law", "statutes", "academic_legal", "vetted_web_legal". Prioritize based on the query.
4.  **subQueries**: For each relevant sourceType, formulate a concise and effective search query string. 
    *   For "case_law", the query should be suitable for a case law database like CourtListener. Include jurisdictional context if specific.
    *   For "statutes", the query should aim to find relevant legislation.
    *   For "academic_legal", the query should be phrased to find scholarly articles, law reviews (this will be further enhanced by academic search operators later).
    *   For "vetted_web_legal", the query should be for finding reliable legal information on the web (e.g., from law firms, legal news, .gov sites).
5.  **sourceLimits**: Define maximum number of items to retrieve for each key source type, considering parameters like maxCases, maxStatutes, maxAcademicArticles, and an overall maxTotalSources.
    *   maxCases: (default 10, from parameters.caseLawPreferences.maxCases)
    *   maxStatutes: (default 5, from parameters.statutePreferences.maxStatutes)
    *   maxAcademicArticles: (default 5, from parameters.academicPreferences.maxArticles)
    *   maxWebSources: (default 5, ensure total is within maxTotalSources)

Output the plan as a JSON object. Example format:
{
  "originalQuery": "${query}",
  "analyzedQuery": "[rephrased query focused on key legal terms]",
  "targetJurisdictions": ["[jurisdiction1]", "[jurisdiction2]"],
  "sourceTypes": ["case_law", "academic_legal"],
  "subQueries": {
    "caseLaw": "[specific query for case law]",
    "academic": "[specific query for academic sources]"
  },
  "maxCases": 10,
  "maxStatutes": 5,
  "maxAcademicArticles": 5,
  "maxWebSources": 5,
  "maxTotalSources": ${parameters?.maxTotalSources || 20}
}

JSON Research Plan:
`;

    try {
      const llmResponse = await this.llm.invoke(planningPromptText);
      let planJson = llmResponse.content.toString();
      
      // Clean up the response to get valid JSON
      if (planJson.includes('```json')) {
        planJson = planJson.split('```json')[1].split('```')[0].trim();
      }
      const parsedPlan = JSON.parse(planJson);

      // Ensure all necessary fields are present and have defaults
      const plan = {
        originalQuery: query,
        analyzedQuery: parsedPlan.analyzedQuery || query,
        targetJurisdictions: parsedPlan.targetJurisdictions || await this.determineJurisdictions(query, parameters || {}),
        sourceTypes: parsedPlan.sourceTypes || ['case_law', 'academic_legal', 'vetted_web_legal'],
        subQueries: {
          caseLaw: parsedPlan.subQueries?.caseLaw || `case law related to ${parsedPlan.analyzedQuery || query}`,
          statutes: parsedPlan.subQueries?.statutes || `statutes related to ${parsedPlan.analyzedQuery || query}`,
          academic: await this.generateAcademicQuery(parsedPlan.subQueries?.academic || `legal scholarship on ${parsedPlan.analyzedQuery || query}`),
          web: parsedPlan.subQueries?.web || `legal information on ${parsedPlan.analyzedQuery || query}`,
        },
        maxCases: parsedPlan.maxCases || parameters?.caseLawPreferences?.maxCases || 10,
        maxStatutes: parsedPlan.maxStatutes || parameters?.statutePreferences?.maxStatutes || 5,
        maxAcademicArticles: parsedPlan.maxAcademicArticles || parameters?.academicPreferences?.maxArticles || 5,
        maxWebSources: parsedPlan.maxWebSources || 5,
        maxTotalSources: parsedPlan.maxTotalSources || parameters?.maxTotalSources || 20,
      };
      
      console.log('Generated research plan:', plan);
      return plan;
    } catch (error) {
      console.error('Error generating research plan with LLM:', error);
      console.warn('Falling back to basic research plan.');
      // Fallback to a simpler plan on error
      return {
        originalQuery: query,
        analyzedQuery: query,
        targetJurisdictions: parameters?.jurisdiction ? [parameters.jurisdiction] : await this.determineJurisdictions(query, parameters || {}),
        sourceTypes: ['case_law', 'statutes', 'academic_legal', 'vetted_web_legal'],
        subQueries: {
          caseLaw: `case law related to ${query}` + (parameters?.jurisdiction ? ` in ${parameters.jurisdiction}` : ''),
          statutes: `statutes related to ${query}` + (parameters?.jurisdiction ? ` in ${parameters.jurisdiction}` : ''),
          academic: await this.generateAcademicQuery(`legal scholarship and analysis on ${query}`),
          web: `legal information and analysis on ${query}`,
        },
        maxCases: parameters?.caseLawPreferences?.maxCases || 10,
        maxStatutes: parameters?.statutePreferences?.maxStatutes || 5,
        maxAcademicArticles: parameters?.academicPreferences?.maxArticles || 5,
        maxWebSources: 5,
        maxTotalSources: parameters?.maxTotalSources || 20,
      };
    }
  }
  
  private async determineJurisdictions(query: string, parameters: Record<string, any> = {}): Promise<string[]> {
    // Adapted from ResearchAgent.ts
    if (parameters.jurisdiction) return [parameters.jurisdiction];
    
    const lowerQuery = query.toLowerCase();
    const jurisdictions: string[] = [];

    // More comprehensive federal keyword check
    const federalKeywords = ['federal', 'constitutional', 'supreme court', 'circuit court', 'u.s.c', 'cfr', 'u.s.'];
    if (federalKeywords.some(kw => lowerQuery.includes(kw))) {
      jurisdictions.push('scotus', 'ca1', 'ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7', 'ca8', 'ca9', 'ca10', 'ca11', 'cadc');
    }
    
    // State-specific keywords from ResearchAgent (can be expanded)
    const stateKeywords: Record<string, string[]> = {
      'texas': ['tex', 'texapp'], 'california': ['cal', 'calapp'], 'new york': ['ny', 'nyapp'],
      'florida': ['fla', 'flaapp'], 'illinois': ['ill', 'illapp'], 'pennsylvania': ['pa', 'pasup', 'pacommw'],
      // Add more states and their typical court identifiers
    };
    
    for (const [state, courts] of Object.entries(stateKeywords)) {
      if (lowerQuery.includes(state)) {
        jurisdictions.push(...courts);
      }
    }
    
    // If LLM is available and no specific jurisdictions found yet, try asking LLM
    if (jurisdictions.length === 0 && this.llm) {
        try {
            const jurisPrompt = `Given the legal query: "${query}", suggest up to 3 relevant U.S. jurisdictions (e.g., "scotus", "ca9", "tex", "del"). If no specific jurisdiction is apparent, return an empty list. Respond with a JSON array of strings.`;
            const llmResponse = await this.llm.invoke(jurisPrompt);
            let jurisJson = llmResponse.content.toString();
            if (jurisJson.includes('```json')) {
                jurisJson = jurisJson.split('```json')[1].split('```')[0].trim();
            }
            const llmJurisdictions = JSON.parse(jurisJson);
            if (Array.isArray(llmJurisdictions) && llmJurisdictions.every(j => typeof j === 'string')) {
                jurisdictions.push(...llmJurisdictions);
            }
        } catch (e) {
            console.warn('LLM failed to suggest jurisdictions:', e);
        }
    }

    // Default to major federal courts if still no specific jurisdiction found by keywords and query is general enough
    if (jurisdictions.length === 0 && !parameters.jurisdiction) {
      // Only add broad federal if query seems general and not state-specific
      const stateKeywordsFound = Object.keys(stateKeywords).some(state => lowerQuery.includes(state));
      if (!stateKeywordsFound) {
        //   jurisdictions.push('scotus', 'ca9', 'ca2', 'cadc'); // Broad federal as a last resort
      }
    }
    // Deduplicate and limit
    const uniqueJurisdictions = [...new Set(jurisdictions)];
    return uniqueJurisdictions.slice(0, 5); // Limit to 5 jurisdictions for performance
  }

  private async executeMultiVectorSearch(researchPlan: any): Promise<Document[]> {
    let allDocs: Document[] = [];
    console.log('Executing multi-vector search based on plan:', researchPlan);

    // a. Legal Database Search (CourtListener)
    if (researchPlan.sourceTypes.includes('case_law') || researchPlan.sourceTypes.includes('statutes')) {
        const caseLawDocs = await this.searchCourtListener(researchPlan.subQueries.caseLaw, researchPlan);
        allDocs = allDocs.concat(caseLawDocs);
        // Potentially a separate call for statutes if API allows or different query needed
    }

    // b. Academic Legal Search
    if (researchPlan.sourceTypes.includes('academic_legal')) {
        const academicDocs = await this.searchAcademicSources(researchPlan.subQueries.academic, researchPlan);
        allDocs = allDocs.concat(academicDocs);
    }
    
    // c. Vetted Web Search for Legal Info
    if (researchPlan.sourceTypes.includes('vetted_web_legal')) {
        const webDocs = await this.searchVettedWeb(researchPlan.subQueries.web, researchPlan);
        allDocs = allDocs.concat(webDocs);
    }
    
    console.log(`Total documents found from all sources: ${allDocs.length}`);
    return allDocs;
  }

  private async searchCourtListener(initialQuery: string, researchPlan: any): Promise<Document[]> {
    console.log(`Searching CourtListener for: "${initialQuery}" based on plan:`, researchPlan);
    const documents: Document[] = [];
    
    // Use optimized query from the plan if available, otherwise generate one
    let optimizedQuery = researchPlan.subQueries?.caseLaw || initialQuery;
    if (!researchPlan.subQueries?.caseLaw && this.llm) {
        // Try to optimize the initial query specifically for case law if not already done in plan
        const optimizationPrompt = `Optimize the following legal query for a case law database search (like CourtListener). Focus on key legal terms and concepts. Query: "${initialQuery}"`;
        const llmResponse = await this.llm.invoke(optimizationPrompt);
        optimizedQuery = llmResponse.content.toString().trim();
        console.log(`Optimized case law query on-the-fly: "${optimizedQuery}"`);
    }
    // Clean up quotes from LLM optimization, similar to ResearchAgent
    if (optimizedQuery.startsWith('"') && optimizedQuery.endsWith('"') && optimizedQuery.length > 2) {
      const innerQuery = optimizedQuery.slice(1, -1);
      if (!innerQuery.includes('"')) {
        optimizedQuery = innerQuery;
      }
    }

    const targetJurisdictions = researchPlan.targetJurisdictions || [];
    const dateAfter = researchPlan.parameters?.dateRange?.start;
    const dateBefore = researchPlan.parameters?.dateRange?.end;
    const maxCasesPerStrategy = Math.floor((researchPlan.maxCases || 10) / (targetJurisdictions.length > 0 ? 2 : 1)); // Divide budget by strategies

    const searchPromises: Promise<{results: any[], searchType: string, court?: string}>[] = [];

    // Strategy 1: Targeted jurisdiction search (if jurisdictions are specified)
    if (targetJurisdictions.length > 0) {
      for (const court of targetJurisdictions) {
        searchPromises.push(
          this.courtListener.searchOpinions(optimizedQuery, {
            court,
            dateAfter,
            dateBefore,
            order_by: researchPlan.parameters?.caseLawPreferences?.orderBy === 'date' ? 'dateFiled desc' : 'score desc',
            page_size: maxCasesPerStrategy,
            precedential_status: researchPlan.parameters?.caseLawPreferences?.includeUnpublished ? undefined : 'Published',
          }).then(results => ({ results: results.results, searchType: 'targeted', court }))
          .catch(e => { console.error(`CourtListener targeted search failed for ${court}:`, e); return {results: [], searchType: 'targeted', court}; })
        );
      }
    }

    // Strategy 2: Broad search (if no specific jurisdictions or as a fallback/supplement)
    // Only run broad search if fewer than N jurisdictions or if explicitly desired
    if (targetJurisdictions.length < 3 || targetJurisdictions.length === 0) {
        searchPromises.push(
          this.courtListener.searchOpinions(optimizedQuery, {
            dateAfter: dateAfter || '2010-01-01', // Default to last ~15 years for broad searches if no date specified
            dateBefore,
            order_by: researchPlan.parameters?.caseLawPreferences?.orderBy === 'date' ? 'dateFiled desc' : 'score desc',
            page_size: maxCasesPerStrategy,
            precedential_status: researchPlan.parameters?.caseLawPreferences?.includeUnpublished ? undefined : 'Published',
          }).then(results => ({ results: results.results, searchType: 'broad' }))
          .catch(e => { console.error('CourtListener broad search failed:', e); return {results: [], searchType: 'broad'}; })
        );
    }
    
    // Strategy 3: Search for statutes/codes (if CourtListener API supports or if query implies)
    // For now, we assume the main query might pick up statutes if CL search is broad enough.
    // A dedicated statute search might be a separate function if needed.
    // if (researchPlan.sourceTypes.includes('statutes')) { ... }

    const allResults = await Promise.all(searchPromises);
    const uniqueCaseUrls = new Set<string>();

    for (const resultSet of allResults) {
      for (const item of resultSet.results) {
        if (item.absolute_url && !uniqueCaseUrls.has(item.absolute_url)) {
          uniqueCaseUrls.add(item.absolute_url);
          // Calculate relevance score (can adapt more detailed logic from ResearchAgent.calculateCaseRelevance later)
          let relevance = 0.5; 
          if (resultSet.searchType === 'targeted') relevance += 0.2;
          if (item.precedential_status === 'Published') relevance += 0.1;

          documents.push(new Document({
            pageContent: item.plain_text || item.html_lawbox || item.html_columbia || item.html || '',
            metadata: {
              type: 'case_law',
              source: 'CourtListener',
              title: item.case_name_short || item.case_name || 'Unknown Case',
              url: item.absolute_url,
              citation: this.extractBestCitation(item.citation || {}),
              date: item.date_filed || item.date_created,
              court: resultSet.court || item.court_id || item.court_name || 'Unknown Court',
              precedentialStatus: item.precedential_status || 'Unknown',
              searchType: resultSet.searchType, // 'targeted' or 'broad'
              docketNumber: item.docket_number,
              relevanceScore: relevance, // Initial simple relevance
              // Potentially add: item.opinions_cited, item.judges, etc.
            }
          }));
        }
      }
    }
    console.log(`Found ${documents.length} unique documents from CourtListener.`);
    return documents.slice(0, researchPlan.maxCases || 10);
  }

  private extractBestCitation(citationMap: Record<string, string>): string {
    if (!citationMap || Object.keys(citationMap).length === 0) return 'N/A';
    // Prioritize common reporters
    if (citationMap['U.S. Reports']) return citationMap['U.S. Reports'];
    if (citationMap['Federal Reporter, Third Series']) return citationMap['Federal Reporter, Third Series'];
    if (citationMap['Federal Reporter, Second Series']) return citationMap['Federal Reporter, Second Series'];
    if (citationMap['Supreme Court Reporter']) return citationMap['Supreme Court Reporter'];
    if (citationMap["Lawyers' Edition, Second Series"]) return citationMap["Lawyers' Edition, Second Series"];
    // Fallback to the first available one
    return Object.values(citationMap)[0];
  }

  private async searchAcademicSources(initialQuery: string, researchPlan: any): Promise<Document[]> {
    console.log(`Searching academic sources for: "${initialQuery}", plan:`, researchPlan);
    const documents: Document[] = [];
    const maxArticles = researchPlan.maxAcademicArticles || 5;

    let academicQuery = researchPlan.subQueries?.academic || initialQuery;
    // If the query wasn't pre-generated with academic operators by the plan, enhance it now.
    if (!researchPlan.subQueries?.academic || !academicQuery.toLowerCase().includes('site:scholar.google.com')) {
        academicQuery = await this.generateAcademicQuery(initialQuery, researchPlan.originalQuery);
    }
    
    console.log(`Executing academic search with query: "${academicQuery}"`);

    try {
      const searchResults = await searchSearxng(academicQuery, {
        engines: ['google scholar', 'google'], // Prioritize Google Scholar
        // Potentially add other academic-focused SearXNG engines if configured
      });

      let count = 0;
      for (const result of searchResults.results) {
        if (count >= maxArticles) break;
        if (result.url && (result.content || result.title)) {
          // Basic vetting: does it look like a paper/article?
          // More advanced vetting could involve checking for PDF, author names, journal mentions in snippet.
          if (this.isPotentiallyAcademicSource(result.url, result.title, result.content)) {
            documents.push(new Document({
              pageContent: result.content || result.title || '',
              metadata: {
                type: 'academic_legal',
                source: 'Academic Web Search',
                title: result.title || 'Untitled Academic Source',
                url: result.url,
                engine: result.engine,
                snippet: result.content?.substring(0, 300),
                // Consider adding authors, publication date if extractable from snippet or title
              }
            }));
            count++;
          }
        }
      }
      console.log(`Found ${documents.length} potential academic documents after filtering.`);
    } catch (error) {
      console.error('Error searching academic sources:', error);
    }
    return documents.slice(0, maxArticles);
  }

  private async generateAcademicQuery(userFollowUpQuery: string, conversationHistory?: string ): Promise<string> {
    if (!this.llm) {
        // Fallback if LLM is not available - basic academic keywords and site restrictions
        return `${userFollowUpQuery} legal scholarship OR "law review" OR "journal of law" OR "legal theory" OR site:scholar.google.com OR site:jstor.org OR site:ssrn.com OR site:*.edu filetype:pdf`;
    }
    
    // Using a prompt inspired by academicSearchRetrieverPrompt
    // Note: academicSearchRetrieverPrompt is a global constant. If it's not imported, we need to define it or import it.
    // For this example, I'll inline a simplified version. 
    // In a real setup, ensure `academicSearchRetrieverPrompt` is available in this scope.
    const academicRetrieverPromptText = `
You will be given a conversation below (if any) and a follow up question. You need to rephrase the follow-up question to optimize it for academic and scholarly search for LEGAL topics. Add academic search operators and keywords that will help find peer-reviewed papers, law review articles, legal journals, and scholarly legal sources.

IMPORTANT: Add terms like "legal research", "legal study", "law paper", "law journal", "legal scholarship", "peer-reviewed legal", "academic law", "university law department", or "DOI" to improve academic legal search results.
Also consider adding specific legal academic sites like "site:scholar.google.com" OR "site:jstor.org" OR "site:ssrn.com" OR "site:heinonline.org" OR "site:*.law.edu" OR "filetype:pdf".
Focus on terms relevant to legal academia.

If it is a writing task or a simple greeting, return \`not_needed\`.

Conversation:
${conversationHistory || 'N/A'}

Follow up question: ${userFollowUpQuery}
Rephrased legal academic question:
`;

    try {
      const llmResponse = await this.llm.invoke(academicRetrieverPromptText);
      const rephrasedQuery = llmResponse.content.toString().trim();
      if (rephrasedQuery.toLowerCase() !== 'not_needed' && rephrasedQuery.length > 0) {
        console.log(`LLM generated academic query: "${rephrasedQuery}"`);
        return rephrasedQuery;
      }
    } catch (error) {
      console.error('LLM failed to generate academic query:', error);
    }
    // Fallback if LLM fails or returns 'not_needed' inappropriately
    return `${userFollowUpQuery} legal scholarship OR "law review" OR "journal of law" OR site:scholar.google.com OR site:jstor.org OR site:ssrn.com filetype:pdf`;
  }

  private isPotentiallyAcademicSource(url: string, title?: string, content?: string): boolean {
    const lowerUrl = url.toLowerCase();
    const lowerTitle = (title || "").toLowerCase();
    const lowerContent = (content || "").substring(0, 500).toLowerCase(); // Check beginning of content

    if (lowerUrl.endsWith('.pdf')) return true;
    if (keywords.some(kw => lowerTitle.includes(kw) || lowerContent.includes(kw))) {
        return true;
    }
    const academicSitePatterns = ['scholar.google', 'jstor.org', 'ssrn.com', 'academia.edu', 'researchgate.net', 'heinonline.org', '.law.edu', '.edu/research'];
    if (academicSitePatterns.some(pattern => lowerUrl.includes(pattern))) return true;

    const academicKeywords = ['abstract', 'introduction', 'methodology', 'results', 'discussion', 'conclusion', 'references', 'citation', 'doi:', 'journal of', 'law review', 'university press', 'working paper', 'conference paper', 'peer-reviewed', 'scholar', 'research article'];
    if (academicKeywords.some(kw => lowerTitle.includes(kw) || lowerContent.includes(kw))) return true;
    
    return false; // Default to false if no strong indicators
  }
  
  private async searchVettedWeb(initialQuery: string, researchPlan: any): Promise<Document[]> {
    console.log(`Searching vetted web sources for: "${initialQuery}" based on plan:`, researchPlan);
    const documents: Document[] = [];
    const maxWebSources = researchPlan.maxWebSources || 5;

    const webQuery = researchPlan.subQueries?.web || initialQuery;
    // We can enhance the webQuery with specific legal terms if not already present.
    const finalWebQuery = webQuery.toLowerCase().includes('legal') || webQuery.toLowerCase().includes('law') 
        ? webQuery 
        : `${webQuery} legal analysis OR law information OR statute OR case law`;

    console.log(`Executing vetted web search with query: "${finalWebQuery}"`);

    try {
        const searchResults = await searchSearxng(finalWebQuery, {
            engines: ['google', 'bing', 'duckduckgo'], // General engines
            // Potentially add filters for .gov, .edu if desired, though isPotentiallyGoodLegalWebSource handles some of this
        });

        let count = 0;
        for (const result of searchResults.results) {
            if (count >= maxWebSources) break;
            if (result.url && (result.content || result.title)) {
                if (this.isPotentiallyGoodLegalWebSource(result.url, result.title, result.content)) {
                    documents.push(new Document({
                        pageContent: result.content || result.title || '',
                        metadata: {
                            type: 'web_legal',
                            source: 'Web Search',
                            title: result.title || 'Untitled Web Source',
                            url: result.url,
                            engine: result.engine,
                            snippet: result.content?.substring(0, 300),
                        }
                    }));
                    count++;
                }
            }
        }
        console.log(`Found ${documents.length} potential vetted web documents after filtering.`);
    } catch (error) {
        console.error('Error searching vetted web sources:', error);
    }
    return documents.slice(0, maxWebSources);
  }

  private isPotentiallyGoodLegalWebSource(url: string, title?: string, content?:string): boolean {
    // This should be enhanced with isLegalSource & isRelevantSource from ResearchAgent
    const lowerUrl = url.toLowerCase();
    const lowerTitle = (title || "").toLowerCase();
    const keywords = ['law', 'legal', 'statute', 'court', 'attorney', 'counsel', 'justice', '.gov', '.edu', 'legislation'];
    if (keywords.some(kw => lowerUrl.includes(kw) || lowerTitle.includes(kw))) {
      return true;
    }
    // Avoid common non-relevant sites
    const junkDomains = ['youtube.com', 'facebook.com', 'twitter.com', 'amazon.com', 'shopping.com'];
    if (junkDomains.some(domain => lowerUrl.includes(domain))) {
      return false;
    }
    return true; // Default to true if no strong negative signal
  }

  private async evaluateAndRankSources(query: string, docs: Document[], researchPlan: any): Promise<Document[]> {
    console.log(`Evaluating and ranking ${docs.length} sources for query: "${query}". Plan:`, researchPlan);
    if (docs.length === 0) return [];

    const queryTerms = (researchPlan.analyzedQuery || query).toLowerCase().split(/\s+/);
    const { maxTotalSources } = researchPlan;

    const scoredDocs = docs.map(doc => {
      let score = 0;
      const metadata = doc.metadata || {}; // Ensure metadata exists
      const title = (metadata.title || "").toLowerCase();
      const contentSample = (doc.pageContent || "").substring(0, 1000).toLowerCase(); // Larger sample for better matching

      // 1. Content Relevance (improved)
      let termMatches = 0;
      let importantTermMatches = 0; // E.g. terms also in title
      for (const term of queryTerms) {
        if (term.length < 3) continue; // Ignore very short terms
        if (contentSample.includes(term)) termMatches++;
        if (title.includes(term)) importantTermMatches++;
      }
      if (queryTerms.length > 0) {
        score += (termMatches / queryTerms.length) * 0.4; // Base content match
        score += (importantTermMatches / queryTerms.length) * 0.2; // Bonus for title match
      }

      // 2. Source Type Weighting
      switch (metadata.type) {
        case 'case_law':
          score += 0.35; // Highest base weight
          // Case-specific relevance factors (adapted from ResearchAgent)
          if (metadata.precedentialStatus === 'Published') score += 0.2;
          else if (metadata.precedentialStatus === 'Unpublished' && researchPlan.parameters?.caseLawPreferences?.includeUnpublished) score += 0.05;
          else if (metadata.precedentialStatus === 'Unpublished') score -= 0.1; // Penalize if not explicitly requested

          const court = metadata.court || '';
          if (typeof court === 'string') { // Ensure court is a string before calling .startsWith or .includes
            if (court.toLowerCase().includes('scotus') || court.toLowerCase().includes('supreme')) score += 0.25;
            else if (court.startsWith('ca') || court.toLowerCase().includes('circuit')) score += 0.15; // Federal Circuit Courts
            else if (court.includes('app') || court.toLowerCase().includes('appeal')) score += 0.1; // State Appellate Courts
          }

          if (metadata.searchType === 'targeted') score += 0.1;
          // Consider date recency for cases if relevant (e.g. from researchPlan.parameters.dateRange)
          break;
        case 'statutes': // Assuming statutes might be a type someday
          score += 0.3;
          break;
        case 'academic_legal':
          score += 0.25;
          // Add factors like known journal, highly cited if that data were available
          break;
        case 'web_legal':
          score += 0.1;
          // Penalize if not from a .gov or .edu or known legal site, unless content is very strong
          if (!(metadata.url?.includes('.gov') || metadata.url?.includes('.edu') || this.isKnownLegalDomain(metadata.url))) {
            score -= 0.05;
          }
          break;
        default:
          score += 0.05; // Generic fallback
      }

      // 3. Initial Relevance Score (from search step, if any)
      if (typeof metadata.relevanceScore === 'number') {
        score += metadata.relevanceScore * 0.1; // Weight the initial score modestly
      }
      
      // 4. Date Recency (optional, configurable based on query needs)
      // Example: if (metadata.date) { ... score based on how recent ... }

      doc.metadata.finalRelevanceScore = parseFloat(score.toFixed(3));
      return doc;
    });
    
    const sortedDocs = scoredDocs.sort((a, b) => (b.metadata.finalRelevanceScore || 0) - (a.metadata.finalRelevanceScore || 0));
    
    // Apply diversity and limits per source type
    const finalResults: Document[] = [];
    const counts = { case_law: 0, academic_legal: 0, web_legal: 0, statutes: 0 };
    const limits = {
        case_law: researchPlan.maxCases || 10,
        academic_legal: researchPlan.maxAcademicArticles || 5,
        web_legal: researchPlan.maxWebSources || 5,
        statutes: researchPlan.maxStatutes || 5, // Assuming a limit for statutes
    };

    for (const doc of sortedDocs) {
      if (finalResults.length >= maxTotalSources) break;
      const type = doc.metadata.type as keyof typeof counts;
      if (type && counts[type] < (limits[type] || 5)) {
        finalResults.push(doc);
        counts[type]++;
      } else if (!type && finalResults.length < maxTotalSources) {
        // For docs with unknown type, add if overall limit not reached
        finalResults.push(doc);
      }
    }
    
    console.log(`Ranked and filtered to ${finalResults.length} documents. Top score: ${finalResults[0]?.metadata.finalRelevanceScore}`);
    finalResults.forEach(doc => console.log(`  - (${doc.metadata.finalRelevanceScore}) [${doc.metadata.type}] ${doc.metadata.title?.substring(0,50)}...`));
    return finalResults;
  }

  // Helper for isPotentiallyGoodLegalWebSource and evaluateAndRankSources
  private isKnownLegalDomain(url?: string): boolean {
    if (!url) return false;
    const legalDomains = [
      'law.cornell.edu', 'justia.com', 'findlaw.com', 'govinfo.gov', 
      'supremecourt.gov', 'uscourts.gov', 'lexisnexis.com', 'westlaw.com', 
      'courtlistener.com', 'oyez.org', 'scotusblog.com', 'americanbar.org'
      // Add more reputable legal domains
    ];
    return legalDomains.some(domain => url.includes(domain));
  }

  private async synthesizeFindings(query: string, sources: Document[], researchPlan: any, agentContext?: AgentContext): Promise<{ synthesizedText: string; keyFindings?: string[]; summary?: string; researchPathways?: string[] }> {
    console.log(`Synthesizing findings from ${sources.length} sources for query: "${query}"`);
    if (!this.llm) {
      const basicResponse = this.generateBasicNonLLMSynthesis(query, sources);
      return { synthesizedText: basicResponse, keyFindings: [], summary: basicResponse.substring(0, 300) + "..." };
    }

    const relevantMatterDocumentsContext = await this.getMatterDocumentContextString(agentContext?.matter_info?.id, agentContext?.fileIds);

    const sourcesString = sources.map((doc, index) => {
      const metadata = doc.metadata || {};
      let sourceOrigin = metadata.source || 'Unknown Source';
      if (metadata.type === 'case_law') sourceOrigin = `${metadata.court || 'CourtListener'}`;
      else if (metadata.type === 'academic_legal') sourceOrigin = `Academic Search via ${metadata.engine || 'Unknown Engine'}`;
      else if (metadata.type === 'web_legal') sourceOrigin = `Web Search via ${metadata.engine || 'Unknown Engine'}`;
      
      return (
        `[${index + 1}] **${metadata.title || 'Untitled Source'}**\n` +
        `   Source Type: ${metadata.type || 'Unknown'}\n` +
        `   Origin: ${sourceOrigin}\n` +
        (metadata.citation ? `   Citation: ${metadata.citation}\n` : ' ') +
        (metadata.date ? `   Date: ${metadata.date}\n` : ' ') +
        (metadata.url ? `   URL: ${metadata.url}\n` : ' ') +
        `   Relevance Score: ${metadata.finalRelevanceScore || 'N/A'}\n` +
        `   Content Snippet: ${doc.pageContent.substring(0, 1200)}...\n---`
      );
    }).join('\n\n');

    // Combine instructions from ResearchAgent's generateLegalResponse and academicSearchResponsePrompt
    const synthesisPromptText = `
You are a highly skilled AI Legal Research Analyst. Your task is to synthesize the provided legal and academic sources to provide a comprehensive, well-cited, and insightful answer to the user's query. Maintain a formal, objective, and analytical tone suitable for legal professionals and academics.

User Query: "${query}"

Research Plan Context:
Original Query: ${researchPlan.originalQuery}
Target Jurisdictions (if any): ${researchPlan.targetJurisdictions.join(', ') || 'N/A'}
Intended Source Types Searched: ${researchPlan.sourceTypes.join(', ')}

${relevantMatterDocumentsContext}

Provided Sources (ranked by relevance, with [number] references):
${sourcesString}

**Critical Synthesis Instructions:**

1.  **Directly Address the Query:** Provide a clear, thorough, and direct answer to "${query}". Structure your response logically, potentially using headings for complex answers (e.g., ## Introduction, ## Applicable Law, ## Analysis, ## Conclusion).
2.  **Integrate and Synthesize:** Do not merely summarize individual sources. Weave information from multiple sources together to build a coherent narrative or argument. Identify corroborating information, discrepancies, or differing perspectives among sources.
3.  **Prioritize Strongest Evidence:** Give more weight to sources with higher relevance scores, primary legal materials (cases, statutes from authoritative courts/jurisdictions), and peer-reviewed academic work.
4.  **Legal and Academic Rigor:**
    *   **For Case Law:** Discuss key holdings, legal reasoning (ratio decidendi), significant dicta if relevant, and the precedential value/court hierarchy. Note the year and court.
    *   **For Statutes:** Explain the relevant provisions and their implications for the query.
    *   **For Academic Sources:** Summarize key arguments, methodologies (if applicable), findings, and the academic consensus or debate. Note authors and publication venues/years if available in metadata.
    *   **For Web Sources:** Treat with caution. Use only if they provide unique, verifiable information or summarize legal concepts well, and clearly state their nature (e.g., "According to a blog post from LawFirmX...[N]").
5.  **Meticulous Citation:** **CRITICAL**: For EVERY factual assertion, legal principle, or piece of information derived from a source, you MUST cite it using the corresponding [number] at the end of the sentence or clause (e.g., "The Supreme Court held X [1]. Several studies confirm this [2][3]."). Citations must EXACTLY match the source numbers provided.
6.  **Jurisdictional Nuance:** If applicable, discuss how legal principles might vary across the targeted jurisdictions. Clearly state when a holding is binding vs. persuasive.
7.  **Identify Ambiguities & Gaps:** Note areas of legal uncertainty, unresolved questions, or where further research might be needed. If sources conflict, explain the conflict.
8.  **Scholarly and Professional Tone:** Write in a formal, objective, analytical style appropriate for legal research memoranda or academic summaries.
9.  **Formatting for Clarity:** Use Markdown for structure (headings, lists, bolding key terms) to enhance readability. Avoid overly conversational language.

**Output Structure:**

   I. **Executive Summary (Optional but Recommended):** A brief (2-4 sentence) overview of the main findings and answer to the query.

   II. **Detailed Analysis:** The main body of your response, following the instructions above.

   III. **Key Legal Findings (Optional but Recommended):** A bulleted list of 3-5 most critical takeaways, each briefly stated and potentially citing key supporting source(s).
       *   Key Finding 1: [Finding] [Source(s)]
       *   Key Finding 2: [Finding] [Source(s)]

   IV. **Potential Research Pathways (Optional):** If appropriate, suggest 1-2 specific avenues for further research based on the analysis.

Begin your synthesized response:
`;

    let synthesizedText = "";
    let keyFindings: string[] = [];
    let summary: string | undefined;
    let researchPathways: string[] | undefined;

    try {
      const llmResponse = await this.llm.invoke(synthesisPromptText);
      synthesizedText = llmResponse.content.toString();

      // Attempt to parse structured output if LLM follows instructions
      const execSummaryMatch = synthesizedText.match(/I\.\s*\*\*Executive Summary\*\*\s*\n?([^#IV]+)/i);
      if (execSummaryMatch && execSummaryMatch[1].trim()) {
        summary = execSummaryMatch[1].trim();
      }

      const keyFindingsSectionMatch = synthesizedText.match(/III\.\s*\*\*Key Legal Findings\*\*\s*\n?((?:\*\s*.+$\n?)+)/im);
      if (keyFindingsSectionMatch && keyFindingsSectionMatch[1]) {
        keyFindings = keyFindingsSectionMatch[1].trim().split(/\n\s*\*\s*/).filter(Boolean);
      }
      
      const pathwaysMatch = synthesizedText.match(/IV\.\s*\*\*Potential Research Pathways\*\*\s*\n?((?:\*\s*.+$\n?|\d+\.\s*.+$\n?)+)/im);
      if (pathwaysMatch && pathwaysMatch[1]) {
          researchPathways = pathwaysMatch[1].trim().split(/\n\s*(?:\*|\d+\.)\s*/).filter(Boolean);
      }

      // If summary is not found via specific header, take first few sentences of the detailed analysis or whole text if short.
      if (!summary) {
          const detailedAnalysisMatch = synthesizedText.match(/II\.\s*\*\*Detailed Analysis\*\*\s*\n?([^]+)/i);
          const mainContent = detailedAnalysisMatch ? detailedAnalysisMatch[1].trim() : synthesizedText;
          if (mainContent.length < 400) {
              summary = mainContent;
          } else {
              const sentences = mainContent.match(/[^.!?]+[.!?]+/g) || [];
              summary = sentences.slice(0, 3).join(' ').trim();
          }
      }

    } catch (error) {
      console.error('LLM synthesis failed:', error);
      synthesizedText = this.generateBasicNonLLMSynthesis(query, sources) + "\n\nError: LLM synthesis failed. Displaying basic source summary.";
      summary = "LLM synthesis failed. Basic source summary provided.";
    }

    return { synthesizedText, keyFindings, summary, researchPathways };
  }

  private generateBasicNonLLMSynthesis(query: string, sources: Document[]): string {
    let response = `# Research Results for: ${query}\n\n`;
    if (sources.length === 0) {
      response += 'No relevant sources found for this query after filtering.';
      return response;
    }
    response += 'Based on the available sources, here are the key documents found (further analysis requires LLM):\n\n';
    sources.forEach((doc, index) => {
      const metadata = doc.metadata || {};
      response += `**[${index + 1}] ${metadata.title || 'Untitled Source'}** (${metadata.type || 'Unknown'})\n`;
      if (metadata.url) response += `   URL: ${metadata.url}\n`;
      if (metadata.citation) response += `   Citation: ${metadata.citation}\n`;
      response += `   Snippet: ${doc.pageContent.substring(0, 250)}...\n\n`;
    });
    return response;
  }

  private async getMatterDocumentContextString(matterId?: string | null, fileIds?: string[]): Promise<string> {
    // Simplified adaptation of ResearchAgent.getDocumentContext
    // In a real scenario, this would fetch actual content from Supabase/storage
    let context = '';
    if (matterId) {
        // Placeholder: Simulate fetching matter document summaries
        context += '\n\nRelevant Matter Documents (Contextual Information - Summaries Only):\n';
        context += `- Matter Document Alpha: Key contract details regarding clause 7.2.\n`;
        context += `- Matter Document Beta: Witness statement summary highlighting timeline inconsistencies.\n`;
    }
    if (fileIds && fileIds.length > 0) {
        context += '\n\nUploaded Files (Contextual Information - Titles Only):\n';
        fileIds.forEach(id => {
            context += `- Uploaded File ID: ${id} (Content not loaded for this summary)\n`;
        });
    }
    return context.trim() ? `\n\n**Additional Context from Matter/Files:**\n${context}\n` : '';
  }
  
  private generateCitations(sources: Document[]): Citation[] {
    return sources.map((doc, index) => ({
      number: index + 1,
      id: doc.metadata.url || `doc-${index + 1}`, // Prefer URL as ID
      title: doc.metadata.title || 'Untitled Source',
      type: doc.metadata.type || 'unknown',
      url: doc.metadata.url,
      // Add other citation fields as needed, e.g., from specific metadata like case citations
      text: `Source [${index + 1}] ${doc.metadata.title} (${doc.metadata.type}) - ${doc.metadata.url || 'No URL'}`
    }));
  }

  // Placeholder for other methods adapted from ResearchAgent or AcademicSearch
  // e.g., isLegalSource, isRelevantSource (from ResearchAgent)
  // e.g., specific academic query rephrasing (from academicSearch prompts)

}

// Schemas would be defined in './schemas.ts'
// export const DeepLegalResearchAgentInputSchema = BaseAgentInputSchema.extend({ ... });
// export const DeepLegalResearchAgentOutputSchema = BaseAgentOutputSchema.extend({ ... }); 