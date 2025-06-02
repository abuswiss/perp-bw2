import { BaseAgent } from './BaseAgent';
import { AgentInput, AgentOutput, AgentCapability, Citation } from './types';
import { CourtListenerAPI } from '@/lib/integrations/courtlistener';
import { performWebSearch } from '@/lib/search/providers';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getDefaultChatModel } from '@/lib/providers';
import { v4 as uuidv4 } from 'uuid';
import { ResearchAgentInputSchema, ResearchAgentOutputSchema } from './schemas';
import { Document } from '@langchain/core/documents';
import computeSimilarity from '@/lib/utils/computeSimilarity';
import type { Embeddings } from '@langchain/core/embeddings';
import { supabaseAdmin } from '@/lib/supabase/client';
import path from 'node:path';
import fs from 'node:fs';

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

  protected getInputSchema() {
    return ResearchAgentInputSchema;
  }

  protected getOutputSchema() {
    return ResearchAgentOutputSchema;
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
      
      // Step 1: Search all sources (like Perplexica MetaSearchAgent)
      await this.logExecution(taskId, 'Searching legal sources', 20);
      const allDocs = await this.searchAllSources(input.query, input.parameters);
      
      // Step 2: Rerank and filter sources by relevance 
      await this.logExecution(taskId, 'Ranking source relevance', 40);
      const rankedDocs = await this.rerankSources(input.query, allDocs);
      
      const webCount = rankedDocs.filter(d => d.metadata.type === 'web').length;
      const caseCount = rankedDocs.filter(d => d.metadata.type === 'case').length;
      console.log('📊 After ranking - Web sources:', webCount, 'Case sources:', caseCount);
      
      // Step 3: Generate citations from sources
      const citations = this.createCitations(rankedDocs);
      
      // Step 4: Get document context if available
      await this.logExecution(taskId, 'Loading document context', 60);
      const documentContext = await this.getDocumentContext(input.matterId, input.context?.fileIds);
      
      // Step 5: Generate single comprehensive response
      await this.logExecution(taskId, 'Generating legal analysis', 90);
      const response = await this.generateLegalResponse(input.query, rankedDocs, documentContext);

      const output: AgentOutput = {
        success: true,
        result: {
          response,
          sources: rankedDocs.slice(0, 20), // Up to 10 cases + 10 web
          query: input.query,
          summary: response.split('\n')[0] // First line as summary
        },
        citations,
        metadata: {
          totalSources: allDocs.length,
          rankedSources: rankedDocs.length,
          executionId,
          executionTime: Date.now() - startTime
        },
        executionTime: Date.now() - startTime
      };

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

  private async searchAllSources(query: string, parameters?: Record<string, any>): Promise<Document[]> {
    const allDocs: Document[] = [];
    
    // Enhanced Court Listener search with advanced filtering
    try {
      console.log('🔍 Starting CourtListener search for:', query);
      await this.searchCourtListenerAdvanced(query, parameters, allDocs);
      const caseCount = allDocs.filter(doc => doc.metadata.type === 'case').length;
      console.log('📊 CourtListener results:', caseCount, 'cases found');
      if (caseCount > 0) {
        console.log('📄 Sample case:', allDocs.find(doc => doc.metadata.type === 'case')?.metadata);
      }
    } catch (error) {
      console.error('Court Listener search failed:', error);
    }
    
    // Search web for legal sources
    try {
      console.log('🌐 Starting web search for:', query);
      const webResults = await performWebSearch(query + ' law legal statute case', {
        categories: ['general'],
        engines: ['google', 'bing']
      });
      
      console.log('🌐 Web search results:', webResults.results?.length || 0, 'found');
      let webSourcesAdded = 0;
      
      for (const result of webResults.results.slice(0, 15)) {
        // More lenient filtering - include legal sources and relevant government/educational sites
        if (this.isRelevantSource(result.url, query)) {
          allDocs.push(new Document({
            pageContent: result.content || result.title,
            metadata: {
              type: 'web',
              title: result.title || 'Unknown Source',
              url: result.url,
              relevance: this.isLegalSource(result.url) ? 0.8 : 0.6
            }
          }));
          webSourcesAdded++;
        }
      }
      console.log('🌐 Web sources added after filtering:', webSourcesAdded);
      if (webSourcesAdded > 0) {
        console.log('🌐 Sample web source:', allDocs.filter(d => d.metadata.type === 'web')[0]?.metadata);
      }
    } catch (error) {
      console.error('Web search failed:', error);
    }
    
    return allDocs;
  }

  private async searchCourtListenerAdvanced(query: string, parameters: Record<string, any> = {}, allDocs: Document[]): Promise<void> {
    // Determine target jurisdictions based on query analysis
    const jurisdictions = this.determineRelevantJurisdictions(query, parameters);
    
    // Generate optimized search query using LLM
    let optimizedQuery = await this.optimizeSearchQuery(query);
    
    // Clean up quotes that might wrap the entire query
    optimizedQuery = optimizedQuery.trim();
    if (optimizedQuery.startsWith('"') && optimizedQuery.endsWith('"') && optimizedQuery.length > 2) {
      // Check if there are no other quotes in the middle
      const innerQuery = optimizedQuery.slice(1, -1);
      if (!innerQuery.includes('"')) {
        optimizedQuery = innerQuery;
      }
    }
    
    console.log('🔍 Original query:', query);
    console.log('✨ Optimized query:', optimizedQuery);
    
    // Enhanced search with multiple strategies
    const searchPromises = [];
    
    // Strategy 1: Targeted jurisdiction search with optimized query
    for (const court of jurisdictions) {
      searchPromises.push(
        this.courtListener.searchOpinions(optimizedQuery, {
          court,
          dateAfter: parameters?.dateRange?.start,
          dateBefore: parameters?.dateRange?.end,
          order_by: 'dateFiled desc', // Sort by date filed, newest first
          page_size: 20
        }).then(results => ({ results, searchType: 'targeted', court }))
      );
    }
    
    // Strategy 2: Broad search with optimized query
    searchPromises.push(
      this.courtListener.searchOpinions(optimizedQuery, {
        order_by: 'dateFiled desc',
        dateAfter: parameters?.dateRange?.start || '2010-01-01', // Last 15 years for relevance
        dateBefore: parameters?.dateRange?.end,
        page_size: 30
      }).then(results => ({ results, searchType: 'broad' }))
    );
    
    // Strategy 3: Citation-based search if query contains case references
    const caseReferences = this.extractCaseReferences(query);
    if (caseReferences.length > 0) {
      for (const caseRef of caseReferences) {
        searchPromises.push(
          this.courtListener.getCitingCases(caseRef, { limit: 20 })
            .then(results => ({ results, searchType: 'citation', reference: caseRef }))
        );
      }
    }
    
    // Execute all searches concurrently
    const searchResults = await Promise.allSettled(searchPromises);
    
    // Log search results for debugging
    let totalCasesFound = 0;
    let failedSearches = 0;
    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        totalCasesFound += result.value.results.results?.length || 0;
      } else {
        failedSearches++;
        console.error('❌ Search failed:', result.reason);
      }
    }
    console.log(`📊 Total cases found across all strategies: ${totalCasesFound}`);
    if (failedSearches > 0) {
      console.log(`⚠️  ${failedSearches} searches failed`);
    }
    
    // Process results with enhanced extraction
    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        const { results, searchType } = result.value;
        const court = 'court' in result.value ? result.value.court : undefined;
        
        for (const caseItem of (results.results || []).slice(0, 15)) {
          // Extract key passages instead of full text for relevance
          const keyPassages = this.courtListener.extractKeyPassages(caseItem.text || '', query, 2);
          const relevantContent = keyPassages.length > 0 ? keyPassages.join(' ... ') : (caseItem.text?.substring(0, 1000) || '');
          
          allDocs.push(new Document({
            pageContent: relevantContent,
            metadata: {
              type: 'case',
              title: caseItem.case_name || 'Unknown Case',
              citation: this.courtListener.formatCitation(caseItem),
              court: caseItem.court || '',
              date: caseItem.date_filed || '',
              url: caseItem.absolute_url ? `https://www.courtlistener.com${caseItem.absolute_url}` : '',
              relevance: this.calculateCaseRelevance(caseItem, query, searchType, court as string),
              precedentialStatus: caseItem.precedential_status,
              searchStrategy: searchType,
              keyPassages
            }
          }));
        }
      }
    }
  }
  
  private determineRelevantJurisdictions(query: string, parameters: Record<string, any> = {}): string[] {
    // If court specified in parameters, use it
    if (parameters.court) return [parameters.court];
    
    const lowerQuery = query.toLowerCase();
    const jurisdictions: string[] = [];
    
    // Federal courts - high priority for constitutional, federal law issues
    if (lowerQuery.includes('federal') || lowerQuery.includes('constitutional') || 
        lowerQuery.includes('supreme court') || lowerQuery.includes('circuit')) {
      jurisdictions.push('scotus', 'ca1', 'ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7', 'ca8', 'ca9', 'ca10', 'ca11', 'cadc');
    }
    
    // State-specific keywords
    const stateKeywords = {
      'texas': ['tex', 'texapp'],
      'california': ['cal', 'calapp'],
      'new york': ['ny', 'nyapp'],
      'florida': ['fla', 'flaapp']
    };
    
    for (const [state, courts] of Object.entries(stateKeywords)) {
      if (lowerQuery.includes(state)) {
        jurisdictions.push(...courts);
      }
    }
    
    // Default to major federal and state courts if no specific jurisdiction found
    if (jurisdictions.length === 0) {
      jurisdictions.push('scotus', 'ca9', 'ca2', 'cadc'); // Major federal courts
    }
    
    return jurisdictions.slice(0, 5); // Limit to 5 jurisdictions for performance
  }
  
  private extractCaseReferences(query: string): string[] {
    // Extract potential case IDs or citation patterns
    const casePatterns = [
      /\b\d{1,4}\s+U\.?S\.?\s+\d+/gi, // US Reports
      /\b\d{1,4}\s+F\.?\d*d?\s+\d+/gi, // Federal Reporter
      /\b\d{1,4}\s+S\.?\s?Ct\.?\s+\d+/gi // Supreme Court Reporter
    ];
    
    const references: string[] = [];
    for (const pattern of casePatterns) {
      const matches = query.match(pattern);
      if (matches) {
        references.push(...matches);
      }
    }
    
    return references.slice(0, 3); // Limit citations to search
  }
  
  private calculateCaseRelevance(caseItem: any, query: string, searchType: string, court?: string): number {
    let relevance = 0.5; // Base relevance
    
    // Boost relevance based on search strategy
    switch (searchType) {
      case 'targeted':
        relevance += 0.3; // Higher relevance for targeted jurisdiction searches
        break;
      case 'citation':
        relevance += 0.4; // Highest relevance for citation-based searches
        break;
      case 'broad':
        relevance += 0.1; // Lower relevance for broad searches
        break;
    }
    
    // Boost for precedential status
    if (caseItem.precedential_status === 'Published') {
      relevance += 0.2;
    } else if (caseItem.precedential_status === 'Unpublished') {
      relevance -= 0.1;
    }
    
    // Boost for higher courts
    if (court === 'scotus') relevance += 0.3;
    else if (court?.startsWith('ca')) relevance += 0.2; // Circuit courts
    else if (court?.includes('app')) relevance += 0.1; // State appellate courts
    
    // Boost for recency (within last 10 years)
    const caseYear = new Date(caseItem.date_filed).getFullYear();
    const currentYear = new Date().getFullYear();
    if (currentYear - caseYear <= 10) {
      relevance += 0.1;
    }
    
    // Boost for query term matches in case name
    const queryTerms = query.toLowerCase().split(/\s+/);
    const caseName = (caseItem.case_name || '').toLowerCase();
    const nameMatches = queryTerms.filter(term => caseName.includes(term)).length;
    relevance += (nameMatches / queryTerms.length) * 0.2;
    
    return Math.min(relevance, 1.0); // Cap at 1.0
  }

  private isLegalSource(url: string): boolean {
    const legalDomains = [
      'law.cornell.edu',
      'justia.com',
      'findlaw.com',
      'govinfo.gov',
      'supremecourt.gov',
      'uscourts.gov',
      'lexisnexis.com',
      'westlaw.com',
      'courtlistener.com',
      'ssrn.com',
      'heinonline.org'
    ];
    
    return legalDomains.some(domain => url.includes(domain)) || 
           url.includes('uscode') || 
           url.includes('statute') || 
           url.includes('regulation');
  }

  private isRelevantSource(url: string, query: string): boolean {
    // Always include legal sources
    if (this.isLegalSource(url)) return true;
    
    // Include government and educational sources
    const relevantDomains = [
      '.gov',
      '.edu',
      'wikipedia.org',
      'ballotpedia.org',
      'oyez.org',
      'law.com',
      'lawandcrime.com',
      'reuters.com',
      'apnews.com',
      'cnn.com',
      'politico.com',
      'npr.org',
      'pbs.org'
    ];
    
    // Check for relevant domains
    if (relevantDomains.some(domain => url.includes(domain))) return true;
    
    // Include if URL contains legal-related keywords
    const legalKeywords = ['law', 'legal', 'court', 'judge', 'statute', 'regulation', 'justice', 'criminal', 'penalty', 'sentencing'];
    const urlLower = url.toLowerCase();
    if (legalKeywords.some(keyword => urlLower.includes(keyword))) return true;
    
    // Include if query terms appear in URL (indicates relevance)
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);
    if (queryTerms.some(term => urlLower.includes(term))) return true;
    
    // Be more lenient - include if content seems relevant
    return url.includes('death') || url.includes('capital') || url.includes('texas') || 
           url.includes('aggravating') || url.includes('factors');
  }

  private async rerankSources(query: string, docs: Document[]): Promise<Document[]> {
    if (docs.length === 0) return docs;
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const scoredDocs = docs.map(doc => {
      let score = 0;
      
      // Content relevance scoring
      const content = (doc.pageContent + ' ' + doc.metadata.title).toLowerCase();
      const contentMatches = queryTerms.filter(term => content.includes(term)).length;
      score += (contentMatches / queryTerms.length) * 0.4;
      
      // Case-specific relevance factors
      if (doc.metadata.type === 'case') {
        // Precedential status weight
        if (doc.metadata.precedentialStatus === 'Published') score += 0.3;
        else if (doc.metadata.precedentialStatus === 'Unpublished') score += 0.1;
        
        // Court hierarchy weight
        const court = doc.metadata.court || '';
        if (court === 'scotus') score += 0.3;
        else if (court.startsWith('ca')) score += 0.2;
        else if (court.includes('app')) score += 0.15;
        
        // Search strategy weight
        if (doc.metadata.searchStrategy === 'citation') score += 0.2;
        else if (doc.metadata.searchStrategy === 'targeted') score += 0.1;
      }
      
      // Base metadata relevance
      score += (doc.metadata.relevance || 0) * 0.2;
      
      // Key passages bonus for cases
      if (doc.metadata.keyPassages && doc.metadata.keyPassages.length > 0) {
        score += 0.1;
      }
      
      return { doc, score };
    });
    
    // Sort by score and apply diversity filter
    const sortedDocs = scoredDocs.sort((a, b) => b.score - a.score);
    
    // Ensure good mix of cases and web sources (10 cases + 10 web max)
    const caseResults: typeof scoredDocs = [];
    const webResults: typeof scoredDocs = [];
    const courtCounts: Record<string, number> = {};
    
    for (const item of sortedDocs) {
      if (item.doc.metadata.type === 'case' && caseResults.length < 10) {
        const court = item.doc.metadata.court || 'unknown';
        const currentCount = courtCounts[court] || 0;
        
        // Limit cases per court to ensure diversity (max 2 per court)
        if (currentCount < 2) {
          caseResults.push(item);
          courtCounts[court] = currentCount + 1;
        }
      } else if (item.doc.metadata.type === 'web' && webResults.length < 10) {
        webResults.push(item);
      }
    }
    
    // Combine results with cases first (higher priority)
    const finalResults = [...caseResults, ...webResults];
    console.log('📊 Final source mix - Cases:', caseResults.length, 'Web:', webResults.length);
    
    return finalResults.map(item => item.doc);
  }

  private createCitations(docs: Document[]): Citation[] {
    return docs.map((doc, index) => ({
      id: `source-${index}`,
      type: doc.metadata.type === 'case' ? 'case' as const : 'web' as const,
      title: doc.metadata.title || `Source ${index + 1}`, // Ensure title is always defined
      citation: doc.metadata.citation || undefined,
      url: doc.metadata.url || undefined,
      court: doc.metadata.court || undefined,
      date: doc.metadata.date || undefined,
      relevance: doc.metadata.relevance || 0.5
    }));
  }

  private async getDocumentContext(matterId: string | null, fileIds?: string[]): Promise<string> {
    let context = '';
    
    // Get matter documents
    if (matterId) {
      try {
        const { data: documents } = await supabaseAdmin
          .from('documents')
          .select('filename, summary, content')
          .eq('matter_id', matterId)
          .limit(5);
        
        if (documents?.length) {
          context += '\n\nRelevant Matter Documents:\n';
          context += documents.map(d => `${d.filename}: ${d.summary || d.content?.substring(0, 200)}`).join('\n');
        }
      } catch (error) {
        console.error('Failed to load matter documents:', error);
      }
    }
    
    // Get uploaded file context
    if (fileIds?.length) {
      try {
        for (const fileId of fileIds.slice(0, 3)) {
          const filePath = path.join(process.cwd(), 'uploads', fileId);
          const contentPath = filePath + '-extracted.json';
          
          if (fs.existsSync(contentPath)) {
            const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
            context += `\n\nUploaded Document (${content.title}): ${content.contents?.slice(0, 3).join(' ') || ''}`;
          }
        }
      } catch (error) {
        console.error('Failed to load file context:', error);
      }
    }
    
    return context;
  }

  private async generateLegalResponse(query: string, sources: Document[], documentContext: string): Promise<string> {
    if (!this.llm) {
      return this.generateBasicResponse(query, sources);
    }
    
    const responsePrompt = PromptTemplate.fromTemplate(`
You are a senior legal research attorney providing comprehensive legal analysis.

User Query: {query}

Relevant Sources:
{sources}
{documentContext}

Provide a comprehensive legal analysis that:
1. Directly answers the legal question
2. Cites specific sources using [1], [2], [3] format (just the number in brackets)
3. Explains applicable law and precedents
4. Discusses any jurisdictional variations
5. Notes areas of legal uncertainty
6. Provides practical guidance

Format your response with clear headings and proper legal analysis structure.
Always cite sources for every legal statement using [1], [2], [3], etc. (just the number, not "Source").
`);
    
    try {
      const sourcesText = sources.map((doc, index) => 
        `Source ${index + 1}: ${doc.metadata.title}\n${doc.pageContent.substring(0, 500)}...\n`
      ).join('\n');
      
      const chain = responsePrompt.pipe(this.llm).pipe(this.strParser);
      const response = await chain.invoke({
        query,
        sources: sourcesText,
        documentContext
      });
      
      return response;
    } catch (error) {
      console.error('AI response generation failed:', error);
      return this.generateBasicResponse(query, sources);
    }
  }

  private generateBasicResponse(query: string, sources: Document[]): string {
    let response = `# Legal Research Analysis\n\n## Query: ${query}\n\n`;
    
    if (sources.length === 0) {
      response += 'No relevant legal sources found for this query.';
      return response;
    }
    
    response += '## Analysis\n\n';
    response += 'Based on the available legal sources, here are the key findings:\n\n';
    
    sources.slice(0, 5).forEach((doc, index) => {
      response += `**${doc.metadata.title}** [Source ${index + 1}]\n`;
      response += `${doc.pageContent.substring(0, 200)}...\n\n`;
    });
    
    response += '## Sources Referenced\n\n';
    sources.forEach((doc, index) => {
      response += `[Source ${index + 1}] ${doc.metadata.title}`;
      if (doc.metadata.citation) response += ` - ${doc.metadata.citation}`;
      if (doc.metadata.url) response += ` (${doc.metadata.url})`;
      response += '\n';
    });
    
    return response;
  }

  private async optimizeSearchQuery(query: string): Promise<string> {
    if (!this.llm) {
      // Fallback: basic keyword extraction
      return this.extractLegalKeywords(query);
    }
    
    try {
      const prompt = PromptTemplate.fromTemplate(`
You are a legal research expert. Convert this natural language question into an optimized search query for case law databases.

User Question: {query}

Instructions:
1. Extract key legal concepts, terms, and phrases
2. Include relevant legal keywords that would appear in court opinions
3. Focus on actionable legal terms rather than conversational language
4. Include synonyms and related legal terminology
5. Remove unnecessary words like "find me", "I need", etc.
6. Keep the query concise but comprehensive
7. CRITICAL: Do NOT wrap the entire query in quotes. Return just the keywords separated by spaces.

Examples:
- "Can police search a car without a warrant?" → warrantless vehicle search automobile exception Fourth Amendment
- "What are the requirements for a valid contract?" → contract formation consideration offer acceptance mutual assent
- "Death penalty cases in Texas" → capital punishment death penalty Texas execution lethal injection

Return ONLY the optimized search query without quotes, no explanation.
`);
      
      const chain = prompt.pipe(this.llm).pipe(this.strParser);
      const optimizedQuery = await chain.invoke({ query });
      
      // Fallback to original query if optimization fails or is empty
      return optimizedQuery.trim() || query;
      
    } catch (error) {
      console.error('Query optimization failed:', error);
      return this.extractLegalKeywords(query);
    }
  }

  private extractLegalKeywords(query: string): string {
    // Fallback method for query optimization without LLM
    const legalTerms = [
      'constitutional', 'statute', 'precedent', 'holding', 'jurisdiction',
      'appellant', 'appellee', 'plaintiff', 'defendant', 'liability',
      'negligence', 'contract', 'tort', 'criminal', 'civil', 'federal',
      'state', 'supreme court', 'circuit', 'district', 'appeal',
      'amendment', 'due process', 'equal protection', 'commerce clause',
      'Miranda', 'search', 'seizure', 'warrant', 'probable cause',
      'death penalty', 'capital punishment', 'execution', 'sentencing'
    ];
    
    const words = query.toLowerCase().split(/\s+/);
    const extractedTerms = words.filter(word => 
      word.length > 3 && !['what', 'when', 'where', 'why', 'how', 'the', 'and', 'or', 'but', 'for', 'with', 'can', 'are', 'is', 'was', 'were', 'find', 'show', 'tell', 'need'].includes(word)
    );
    
    // Add any legal terms found in the query
    const foundLegalTerms = legalTerms.filter(term => 
      query.toLowerCase().includes(term.toLowerCase())
    );
    
    return [...new Set([...extractedTerms, ...foundLegalTerms])].join(' ') || query;
  }
}
