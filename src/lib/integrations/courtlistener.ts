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

  // Search for opinions (case law)
  async searchOpinions(query: string, options?: SearchOptions): Promise<CourtListenerSearchResult> {
    const params = new URLSearchParams({
      q: query,
      ...(options?.court && { cluster__docket__court: options.court }),
      ...(options?.dateAfter && { cluster__date_filed__gte: options.dateAfter }),
      ...(options?.dateBefore && { cluster__date_filed__lte: options.dateBefore }),
      ...(options?.order_by && { order_by: options.order_by }),
      ...(options?.page && { page: options.page.toString() }),
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
    return this.searchOpinions(query, options);
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

  // Extract key passages from case text
  extractKeyPassages(text: string, query: string, maxPassages: number = 3): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    // Score sentences based on query term presence
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const score = queryTerms.reduce((acc, term) => {
        return acc + (lowerSentence.includes(term) ? 1 : 0);
      }, 0);
      
      return { sentence: sentence.trim(), score };
    });

    // Sort by score and return top passages
    return scoredSentences
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPassages)
      .map(s => s.sentence);
  }

  // Search multiple jurisdictions
  async searchMultipleJurisdictions(
    query: string, 
    jurisdictions: string[], 
    options?: Omit<SearchOptions, 'court'>
  ): Promise<CourtListenerCase[]> {
    const results: CourtListenerCase[] = [];
    
    for (const court of jurisdictions) {
      try {
        const searchResult = await this.searchCases(query, { ...options, court });
        results.push(...searchResult.results);
      } catch (error) {
        console.error(`Error searching ${court}:`, error);
      }
    }
    
    // Remove duplicates based on case ID
    const uniqueResults = Array.from(
      new Map(results.map(item => [item.id, item])).values()
    );
    
    return uniqueResults;
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