import FirecrawlApp, { type ScrapeParams, type ScrapeResponse } from '@mendable/firecrawl-js';

export interface FirecrawlExtractResult {
  url: string;
  title?: string;
  description?: string;
  content: string;
  markdown?: string;
  html?: string;
  metadata?: {
    author?: string;
    publishedDate?: string;
    keywords?: string[];
    sourceUrl?: string;
    language?: string;
    [key: string]: any;
  };
  links?: string[];
  images?: string[];
  error?: string;
}

export interface FirecrawlSearchResult {
  url: string;
  title: string;
  description: string;
  content?: string;
  markdown?: string;
  score?: number;
}

export interface FirecrawlConfig {
  apiKey: string;
  maxRetries?: number;
  timeout?: number;
}

export interface DeepResearchResult {
  query: string;
  synthesis: string;
  keyFindings: string[];
  sources: Array<{
    url: string;
    title: string;
    relevantContent: string;
    confidence: number;
  }>;
  timestamp: string;
  model?: string;
}

// Define an interface for the expected structure of 'data' in a successful scrape response
// based on usage and OpenAPI spec.
interface FirecrawlScrapeSuccessData {
  metadata?: {
    title?: string;
    ogTitle?: string;
    description?: string;
    ogDescription?: string;
    author?: string;
    ogAuthor?: string;
    publishedDate?: string;
    datePublished?: string;
    keywords?: string | string[]; // API might return string or array, we normalize to string[]
    url?: string;
    language?: string;
    lang?: string;
    [key: string]: any;
  };
  content?: string;
  text?: string;
  markdown?: string;
  html?: string;
  [key: string]: any;
}

const apiKey = process.env.FIRECRAWL_API_KEY;

if (!apiKey) {
  console.warn(
    '[Firecrawl] API key not found. Please set the FIRECRAWL_API_KEY environment variable. Deep research features will be limited.'
  );
}

// Initialize the FirecrawlApp with enhanced configuration
const app = apiKey ? new FirecrawlApp({ apiKey }) : null;

// Define a more specific type for params to guide callers and help with type inference
interface CustomScrapeParams extends Omit<ScrapeParams, 'url' | 'formats'> {
  formats?: string | string[] | null; // Allow null to explicitly remove formats
  [key: string]: any; // Allow other properties
}

/**
 * Extracts structured content from a URL with enhanced metadata and formatting
 */
export const extractContentFromUrl = async (
  url: string,
  params?: Partial<CustomScrapeParams>
): Promise<FirecrawlExtractResult | null> => {
  if (!app || typeof app.scrapeUrl !== 'function') {
    console.error('[Firecrawl] App not initialized or scrapeUrl is not a function. Missing API key or library issue?');
    return {
      url,
      content: '',
      markdown: '',
      error: 'Firecrawl client not properly initialized'
    };
  }

  if (!url) {
    console.error('[Firecrawl] URL is required for extraction.');
    return null;
  }

  try {
    const defaultApiParams: Record<string, any> = {
      onlyMainContent: true,
      waitFor: 2000,
      formats: ['markdown', 'html'], // Default formats
      blockAds: true,
    };

    // Start with defaults, then selectively override.
    let apiParams: Record<string, any> = { ...defaultApiParams };

    if (params) {
      // Override all other params except formats and url initially
      const { url: paramsUrl, formats: paramsFormats, ...otherProvidedParams } = params;
      apiParams = { ...apiParams, ...otherProvidedParams };

      // Handle 'formats' carefully
      if (params.hasOwnProperty('formats')) { // Check if formats is explicitly provided
        if (typeof paramsFormats === 'string') {
          apiParams.formats = [paramsFormats];
        } else if (Array.isArray(paramsFormats)) {
          apiParams.formats = paramsFormats;
        } else if (paramsFormats === null || paramsFormats === undefined) {
          // If caller explicitly passes null/undefined for formats, remove it from params
          // (though Firecrawl might have a default or error out)
          delete apiParams.formats;
        } 
        // If paramsFormats is some other type, it's an error, default remains or it's absent if deleted.
      }
      // If params.formats was not provided at all, apiParams.formats will retain its default value.
    }
    
    apiParams.url = url; // Ensure the primary URL from function argument is always set last.

    console.log(`[Firecrawl] Extracting content from: ${url} with params:`, apiParams);
    // The type `ScrapeParams` for `app.scrapeUrl` might expect `formats: string[]`
    // We ensure apiParams.formats is string[] or undefined.
    const finalApiParams = { ...apiParams };
    if (finalApiParams.formats !== undefined && !Array.isArray(finalApiParams.formats)) {
        // This case should ideally not be hit if logic above is correct, but as a safeguard:
        finalApiParams.formats = [String(finalApiParams.formats)]; 
    }

    // Retry logic with exponential backoff for rate limiting
    const maxRetries = 3;
    let response: any = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Firecrawl] Retry attempt ${attempt}/${maxRetries} for: ${url}`);
          // Wait with exponential backoff: 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

        // Casting to 'any' here to bypass persistent linter issues with library type definitions
        // after multiple attempts to align types. The apiParams object is structured
        // according to the Firecrawl API v1 documentation.
        const responseFromFirecrawl = await app.scrapeUrl(url, apiParams as any);

        // Cast response to any to handle potential type mismatches with the library
        response = responseFromFirecrawl;
        
        // If successful, break out of retry loop
        if (response && response.success) {
          break;
        }
        
        // If response indicates rate limiting, continue to retry
        if (response && response.error && (response.error.includes('429') || response.error.includes('rate limit'))) {
          lastError = new Error(`Rate limiting: ${response.error}`);
          if (attempt === maxRetries) {
            throw lastError;
          }
          continue;
        }
        
        // For other types of errors, don't retry
        break;
        
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a rate limiting error (429 status)
        const isRateLimit = error.message && (
          error.message.includes('429') || 
          error.message.includes('rate limit') ||
          error.message.includes('Rate limit') ||
          error.statusCode === 429
        );
        
        if (isRateLimit && attempt < maxRetries) {
          console.log(`[Firecrawl] Rate limited (attempt ${attempt}/${maxRetries}), retrying in ${Math.pow(2, attempt)} seconds...`);
          continue;
        }
        
        // If not rate limiting or we've exhausted retries, break
        throw error;
      }
    }

    if (response && response.success && typeof response.data === 'object' && response.data !== null) {
      const data: FirecrawlScrapeSuccessData = response.data;
      
      let finalKeywords: string[] = [];
      if (data.metadata && data.metadata.keywords) {
        if (typeof data.metadata.keywords === 'string') {
          finalKeywords = data.metadata.keywords.split(',').map((k: string) => k.trim());
        } else if (Array.isArray(data.metadata.keywords)) {
          finalKeywords = data.metadata.keywords.map(k => String(k).trim());
        }
      }

      const result: FirecrawlExtractResult = {
        url,
        title: data.metadata?.title || data.metadata?.ogTitle || '',
        description: data.metadata?.description || data.metadata?.ogDescription || '',
        content: data.content || data.text || '',
        markdown: data.markdown || '',
        html: data.html || '',
        metadata: {
          author: data.metadata?.author || data.metadata?.ogAuthor,
          publishedDate: data.metadata?.publishedDate || data.metadata?.datePublished,
          keywords: finalKeywords,
          sourceUrl: data.metadata?.url || url,
          language: data.metadata?.language || data.metadata?.lang,
          ...(data.metadata || {}),
        },
        links: extractLinks(data.html || ''),
        images: extractImages(data.html || ''),
      };

      console.log(`[Firecrawl] Successfully extracted from ${url}:`, {
        contentLength: result.content.length,
        markdownLength: result.markdown?.length || 0,
        linksFound: result.links?.length || 0,
      });

      return result;
    } else {
      console.error(`[Firecrawl] Failed to extract from ${url}:`, response?.error || 'Response missing data or not successful');
      return {
        url,
        content: '',
        markdown: '',
        error: response?.error || 'Extraction failed, response indicates no success or missing data'
      };
    }
  } catch (error: any) {
    console.error(`[Firecrawl] Error extracting from ${url}:`, error);
    const errorMessage = error.response?.data?.error || error.message || 'Extraction failed due to an unexpected error';
    const firecrawlStatusCode = error.response?.status;

    return {
      url,
      content: '',
      markdown: '',
      error: `Firecrawl Error (Status: ${firecrawlStatusCode || 'N/A'}): ${errorMessage}`
    };
  }
};

/**
 * Extract content from multiple URLs in parallel with progress tracking
 */
export const extractMultipleUrls = async (
  urls: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<FirecrawlExtractResult[]> => {
  console.log(`[Firecrawl] Extracting content from ${urls.length} URLs`);

  const results: FirecrawlExtractResult[] = [];
  let completed = 0;

  // Process in smaller batches to avoid rate limits and add delays
  const batchSize = 2; // Reduced from 3 to 2
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    
    // Add delay between batches to respect rate limits
    if (i > 0) {
      console.log(`[Firecrawl] Waiting 3 seconds before next batch to respect rate limits...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const batchPromises = batch.map(url => extractContentFromUrl(url));
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else {
        results.push({
          url: batch[index],
          content: '',
          markdown: '',
          error: 'Failed to extract content'
        });
      }
      completed++;
      onProgress?.(completed, urls.length);
    });
  }

  console.log(`[Firecrawl] Extraction complete. Success: ${results.filter(r => !r.error).length}/${urls.length}`);
  return results;
};

/**
 * Helper function to extract links from HTML
 */
function extractLinks(html: string): string[] {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const link = match[1];
    if (link && (link.startsWith('http') || link.startsWith('https'))) {
      links.push(link);
    }
  }

  return [...new Set(links)].slice(0, 50); // Limit to 50 unique links
}

/**
 * Helper function to extract images from HTML
 */
function extractImages(html: string): string[] {
  const imgRegex = /<img\s+(?:[^>]*?\s+)?src="([^"]*)"/gi;
  const images: string[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && (src.startsWith('http') || src.startsWith('https') || src.startsWith('//'))) {
      images.push(src.startsWith('//') ? `https:${src}` : src);
    }
  }

  return [...new Set(images)].slice(0, 20); // Limit to 20 unique images
}

/**
 * Performs a web search and returns URLs (Note: Firecrawl search may require specific plan)
 */
export const searchWebAndExtract = async (
  query: string,
  limit: number = 10
): Promise<FirecrawlSearchResult[] | null> => {
  if (!app) {
    console.error('[Firecrawl] App not initialized. Missing API key.');
    return null;
  }

  try {
    console.log(`[Firecrawl] Searching for: "${query}"`);
    
    // Note: Firecrawl search functionality may not be available in all plans
    // If search is not available, we'll need to integrate with existing search
    const response = await app.search(query, { 
      limit,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
      }
    });

    if (response && response.success && response.data) {
      const results: FirecrawlSearchResult[] = response.data.map((item: any) => ({
        url: item.url,
        title: item.title || '',
        description: item.description || item.snippet || '',
        content: item.content,
        markdown: item.markdown,
        score: item.score,
      }));

      console.log(`[Firecrawl] Found ${results.length} results for "${query}"`);
      return results;
    }

    return null;
  } catch (error: any) {
    // If search is not available, log but don't fail
    if (error.message?.includes('search') || error.status === 404) {
      console.log('[Firecrawl] Search functionality not available. Use alternative search provider.');
      return null;
    }
    
    console.error(`[Firecrawl] Search error:`, error);
    return null;
  }
};

/**
 * Main Firecrawl service class for more complex operations
 */
export class FirecrawlService {
  private static instance: FirecrawlService | null = null;

  private constructor() {}

  static getInstance(): FirecrawlService {
    if (!FirecrawlService.instance) {
      FirecrawlService.instance = new FirecrawlService();
    }
    return FirecrawlService.instance;
  }

  /**
   * Perform deep research on a topic by extracting and analyzing multiple sources
   */
  async performDeepResearch(
    query: string,
    urls: string[],
    options?: {
      maxUrls?: number;
      includeSearch?: boolean;
      onProgress?: (message: string) => void;
    }
  ): Promise<DeepResearchResult> {
    const startTime = new Date();
    options?.onProgress?.('Starting deep research...');

    // If no URLs provided and search is requested, try to find relevant URLs
    if (urls.length === 0 && options?.includeSearch) {
      options.onProgress?.('Searching for relevant sources...');
      const searchResults = await searchWebAndExtract(query, options.maxUrls || 10);
      if (searchResults) {
        urls = searchResults.map(r => r.url);
      }
    }

    // Limit URLs if specified
    if (options?.maxUrls && urls.length > options.maxUrls) {
      urls = urls.slice(0, options.maxUrls);
    }

    // Extract content from all URLs
    options?.onProgress?.(`Extracting content from ${urls.length} sources...`);
    const extractedContent = await extractMultipleUrls(urls, (completed, total) => {
      options?.onProgress?.(`Extracted ${completed}/${total} sources`);
    });

    // Filter successful extractions
    const validContent = extractedContent.filter(c => !c.error && c.content);
    
    options?.onProgress?.('Research extraction complete');

    // Return structured result (synthesis will be done by the agent)
    return {
      query,
      synthesis: '', // Will be filled by the agent
      keyFindings: [], // Will be filled by the agent
      sources: validContent.map(content => ({
        url: content.url,
        title: content.title || 'Untitled',
        relevantContent: content.markdown || content.content,
        confidence: 1.0, // Will be calculated by the agent
      })),
      timestamp: startTime.toISOString(),
    };
  }

  /**
   * Check if Firecrawl service is available
   */
  isAvailable(): boolean {
    return !!app;
  }
}

// Export singleton instance
export const firecrawlService = FirecrawlService.getInstance(); 