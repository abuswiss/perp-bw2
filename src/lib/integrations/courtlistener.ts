interface CourtListenerCase {
  id: number;
  case_name: string;
  citation: string[];
  court: string;
  date_filed: string;
  text: string;
  author?: string;
  type?: string;
  status?: string;
  precedential_status?: string;
  absolute_url?: string;
}

interface CourtListenerOpinion {
  id: number;
  cluster_id: number;
  cluster: string; // URL to cluster endpoint
  plain_text: string;
  absolute_url: string;
  author_str?: string;
  type?: string;
}

interface CourtListenerCluster {
  id: number;
  case_name: string;
  citation: string[];
  precedential_status: string;
  date_filed: string;
  docket: {
    court: string;
    court_id: string;
  };
}

interface CourtListenerOpinionResult {
  count: number;
  next?: string;
  previous?: string;
  results: CourtListenerOpinion[];
}

interface CourtListenerSearchResult {
  count: number;
  next?: string;
  previous?: string;
  results: CourtListenerCase[];
}

interface SearchOptions {
  court?: string;
  dateAfter?: string;
  dateBefore?: string;
  type?: 'opinion' | 'recap';
  order_by?: string;
  page?: number;
  precedential_status?: 'Published' | 'Unpublished' | 'Errata' | 'Separate';
  fields?: string; // For field selection to improve performance
  jurisdiction?: 'F' | 'FD' | 'FB' | 'FT' | 'FS'; // Federal jurisdictions
  author?: string;
  page_size?: number;
}

interface AdvancedSearchOptions extends SearchOptions {
  case_name_contains?: string;
  citation_contains?: string;
  text_contains?: string;
  exclude_courts?: string[];
  min_precedential_status?: string;
  related_cases?: boolean;
}

export class CourtListenerAPI {
  private apiKey: string;
  private baseUrl = 'https://www.courtlistener.com/api/rest/v4';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COURTLISTENER_API_KEY || '';
  }

  private async makeRequest(endpoint: string, options?: RequestInit) {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Token ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CourtListener API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Enhanced search for opinions with advanced filtering
  async searchOpinions(query: string, options?: SearchOptions): Promise<CourtListenerSearchResult> {
    // Use the search API endpoint for full-text search with better results
    const searchParams = new URLSearchParams({
      q: query,
      type: 'o', // opinions
      ...(options?.court && { court: options.court }),
      ...(options?.dateAfter && { filed_after: options.dateAfter }),
      ...(options?.dateBefore && { filed_before: options.dateBefore }),
      ...(options?.order_by && { order_by: options.order_by }),
      ...(options?.page_size && { page_size: options.page_size.toString() }),
      format: 'json'
    });

    const result = await this.makeRequest(`/search/?${searchParams}`);
    
    // Transform search results to expected case format
    const transformedResults: CourtListenerCase[] = await Promise.all(
      result.results.map(async (item: any) => {
        // Try to get full text from the first opinion if available
        let text = '';
        let fullTextFetched = false;
        
        if (item.opinions && item.opinions.length > 0 && item.opinions[0].id) {
          try {
            const opinionId = item.opinions[0].id;
            const opinion = await this.makeRequest(`/opinions/${opinionId}/`);
            if (opinion.plain_text) {
              text = opinion.plain_text;
              fullTextFetched = true;
            }
          } catch (error) {
            console.error(`Failed to fetch opinion ${item.opinions[0].id}:`, error);
          }
        }
        
        // Fallback to snippet/syllabus if we couldn't get full text
        if (!fullTextFetched) {
          text = item.snippet || item.syllabus || '';
        }
        
        return {
          id: item.cluster_id || item.id,
          case_name: item.caseName || item.caseNameFull || 'Unknown Case',
          citation: Array.isArray(item.citation) ? item.citation : (item.citation ? [item.citation] : []),
          court: item.court || item.court_citation_string || 'Unknown Court',
          date_filed: item.dateFiled || '',
          text: text,
          precedential_status: item.status || 'Unknown',
          author: item.judge || item.attorney || '',
          type: 'search_result',
          absolute_url: item.absolute_url || ''
        };
      })
    );

    return {
      count: result.count || 0,
      next: result.next,
      previous: result.previous,
      results: transformedResults
    };
  }
  
  // Advanced search with multiple filters
  async advancedSearch(options: AdvancedSearchOptions): Promise<CourtListenerSearchResult> {
    const params = new URLSearchParams();
    
    // Build query based on advanced options
    if (options.case_name_contains) {
      params.append('cluster__case_name__icontains', options.case_name_contains);
    }
    
    if (options.citation_contains) {
      params.append('cluster__citation__icontains', options.citation_contains);
    }
    
    if (options.text_contains) {
      params.append('plain_text__icontains', options.text_contains);
    }
    
    // Exclude specific courts
    if (options.exclude_courts?.length) {
      for (const court of options.exclude_courts) {
        params.append('cluster__docket__court!', court);
      }
    }
    
    // Add standard search options
    Object.entries(options).forEach(([key, value]) => {
      if (value && !['case_name_contains', 'citation_contains', 'text_contains', 'exclude_courts', 'related_cases'].includes(key)) {
        if (key === 'court') {
          params.append('cluster__docket__court', value as string);
        } else if (key === 'dateAfter') {
          params.append('cluster__date_filed__gte', value as string);
        } else if (key === 'dateBefore') {
          params.append('cluster__date_filed__lte', value as string);
        } else {
          params.append(key, value.toString());
        }
      }
    });
    
    return this.makeRequest(`/opinions/?${params}`);
  }

  // Search for opinion clusters (grouped cases)
  async searchClusters(query: string, options?: SearchOptions): Promise<CourtListenerSearchResult> {
    const params = new URLSearchParams({
      case_name__icontains: query,
      ...(options?.court && { docket__court: options.court }),
      ...(options?.dateAfter && { date_filed__gte: options.dateAfter }),
      ...(options?.dateBefore && { date_filed__lte: options.dateBefore }),
      ...(options?.order_by && { order_by: options.order_by }),
      ...(options?.page && { page: options.page.toString() }),
    });

    return this.makeRequest(`/clusters/?${params}`);
  }

  // Legacy method for backward compatibility
  async searchCases(query: string, options?: SearchOptions): Promise<CourtListenerSearchResult> {
    // Set a reasonable default page_size if not provided
    const defaultOptions = {
      page_size: 10,
      ...options
    };
    return this.searchOpinions(query, defaultOptions);
  }

  async getOpinionById(id: string): Promise<CourtListenerCase> {
    return this.makeRequest(`/opinions/${id}/`);
  }

  async getClusterById(id: string) {
    return this.makeRequest(`/clusters/${id}/`);
  }

  async getDocketById(id: string) {
    return this.makeRequest(`/dockets/${id}/`);
  }

  // Get cases that cite a specific opinion
  async getCitingCases(opinionId: string, options?: { limit?: number }) {
    const params = new URLSearchParams({
      cited_opinion: opinionId,
      ...(options?.limit && { page_size: options.limit.toString() }),
    });

    return this.makeRequest(`/search/?type=o&${params}`);
  }

  // Get cases cited by a specific opinion
  async getCitedCases(opinionId: string, options?: { limit?: number }) {
    const params = new URLSearchParams({
      citing_opinion: opinionId,
      ...(options?.limit && { page_size: options.limit.toString() }),
    });

    return this.makeRequest(`/search/?type=o&${params}`);
  }

  // Helper function to format citations in legal format
  formatCitation(caseData: CourtListenerCase): string {
    if (caseData.citation && caseData.citation.length > 0) {
      return `${caseData.case_name}, ${caseData.citation.join(', ')} (${caseData.court} ${new Date(caseData.date_filed).getFullYear()})`;
    }
    return `${caseData.case_name} (${caseData.court} ${new Date(caseData.date_filed).getFullYear()})`;
  }

  // Enhanced key passage extraction with legal context
  extractKeyPassages(text: string, query: string, maxPassages: number = 3): string[] {
    if (!text) return [];
    
    // Split into sentences, handling legal citation patterns
    const sentences = text.split(/[.!?]+(?=\s+[A-Z]|\s*$)/).filter(s => s.trim().length > 50);
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    // Legal keywords that boost relevance
    const legalKeywords = [
      'holding', 'rule', 'principle', 'standard', 'test', 'analysis', 'reasoning',
      'conclusion', 'finding', 'decision', 'judgment', 'precedent', 'authority'
    ];
    
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      let score = 0;
      
      // Query term matches
      const queryMatches = queryTerms.filter(term => lowerSentence.includes(term)).length;
      score += queryMatches * 2;
      
      // Legal keyword bonus
      const legalMatches = legalKeywords.filter(keyword => lowerSentence.includes(keyword)).length;
      score += legalMatches;
      
      // Boost for sentences with legal citations
      if (/\d+\s+[A-Z][\w\.]+\s+\d+/.test(sentence)) {
        score += 1;
      }
      
      // Boost for sentences with quotations (often important holdings)
      if (/["'].*["']/.test(sentence)) {
        score += 0.5;
      }
      
      // Penalty for very long sentences (often procedural)
      if (sentence.length > 500) {
        score -= 1;
      }
      
      return { sentence: sentence.trim(), score };
    });

    // Return top passages with context
    const topPassages = scoredSentences
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPassages)
      .map(s => s.sentence);
      
    // Clean up passages
    return topPassages.map(passage => {
      // Remove excessive whitespace and normalize
      return passage.replace(/\s+/g, ' ').trim();
    });
  }

  // Search multiple jurisdictions with performance optimization
  async searchMultipleJurisdictions(
    query: string, 
    jurisdictions: string[], 
    options?: Omit<SearchOptions, 'court'>
  ): Promise<CourtListenerCase[]> {
    // Use Promise.allSettled for concurrent searches
    const searchPromises = jurisdictions.map(async (court) => {
      try {
        return await this.searchOpinions(query, { 
          ...options, 
          court,
          fields: 'id,case_name,citation,court,date_filed,text,precedential_status', // Optimize fields
          page_size: 20 // Limit results per jurisdiction
        });
      } catch (error) {
        console.error(`Error searching ${court}:`, error);
        return { count: 0, results: [] } as CourtListenerSearchResult;
      }
    });
    
    const searchResults = await Promise.allSettled(searchPromises);
    const allResults: CourtListenerCase[] = [];
    
    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value.results);
      }
    }
    
    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );
    
    // Sort by date and precedential status
    return uniqueResults.sort((a, b) => {
      // Precedential cases first
      if (a.precedential_status === 'Published' && b.precedential_status !== 'Published') return -1;
      if (b.precedential_status === 'Published' && a.precedential_status !== 'Published') return 1;
      
      // Then by date (newest first)
      return new Date(b.date_filed).getTime() - new Date(a.date_filed).getTime();
    });
  }
  
  // Get court hierarchy information
  async getCourtInfo(courtId: string) {
    return this.makeRequest(`/courts/${courtId}/`);
  }
  
  // Search by legal topic/subject matter
  async searchByTopic(topic: string, options?: SearchOptions): Promise<CourtListenerSearchResult> {
    const topicQueries = {
      'constitutional': 'constitutional OR "due process" OR "equal protection" OR "first amendment"',
      'criminal': 'criminal OR prosecution OR defendant OR "criminal law"',
      'contract': 'contract OR agreement OR breach OR "contract law"',
      'tort': 'tort OR negligence OR liability OR damages OR "personal injury"',
      'corporate': 'corporate OR corporation OR "business law" OR securities',
      'employment': 'employment OR labor OR workplace OR discrimination OR "employment law"',
      'intellectual_property': '"intellectual property" OR patent OR trademark OR copyright',
      'tax': 'tax OR taxation OR IRS OR "tax law"',
      'environmental': 'environmental OR EPA OR pollution OR "environmental law"'
    };
    
    const searchQuery = topicQueries[topic as keyof typeof topicQueries] || topic;
    
    return this.searchOpinions(searchQuery, {
      ...options,
      order_by: 'score desc',  // Sort by relevance for topic searches
      precedential_status: 'Published', // Focus on published opinions for topics
      page_size: 50
    });
  }

  // Get related cases based on citations
  async getRelatedCases(caseId: string, depth: number = 1): Promise<CourtListenerCase[]> {
    const relatedCases: CourtListenerCase[] = [];
    const processedIds = new Set<number>();
    
    const processCitations = async (id: string, currentDepth: number) => {
      if (currentDepth > depth) return;
      
      try {
        // Get cases this case cites
        const citedCases = await this.getCitedCases(id);
        
        // Get cases that cite this case
        const citingCases = await this.getCitingCases(id);
        
        const allCitations = [...(citedCases.results || []), ...(citingCases.results || [])];
        
        for (const citation of allCitations) {
          if (!processedIds.has(citation.id)) {
            processedIds.add(citation.id);
            
            try {
              const caseDetails = await this.getOpinionById(citation.id.toString());
              relatedCases.push(caseDetails);
              
              if (currentDepth < depth) {
                await processCitations(citation.id.toString(), currentDepth + 1);
              }
            } catch (error) {
              console.error(`Error fetching case ${citation.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing citations for ${id}:`, error);
      }
    };
    
    await processCitations(caseId, 1);
    
    return relatedCases;
  }
}