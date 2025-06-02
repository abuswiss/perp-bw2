import axios from 'axios';
import { searchSearxng } from '../searxng';

export interface SearchResult {
  title: string;
  url: string;
  content?: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  author?: string;
  iframe_src?: string;
}

export interface SearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

// Google Custom Search API
async function searchGoogle(query: string, options?: SearchOptions): Promise<{ results: SearchResult[]; suggestions: string[] }> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    throw new Error('Google Search API credentials not configured');
  }

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: apiKey,
        cx: searchEngineId,
        q: query,
        num: 10,
        ...(options?.language && { lr: `lang_${options.language}` }),
        ...(options?.pageno && { start: ((options.pageno - 1) * 10) + 1 })
      }
    });

    const results: SearchResult[] = response.data.items?.map((item: any) => ({
      title: item.title,
      url: item.link,
      content: item.snippet,
      thumbnail_src: item.pagemap?.cse_thumbnail?.[0]?.src,
    })) || [];

    const suggestions: string[] = response.data.spelling?.correctedQuery ? [response.data.spelling.correctedQuery] : [];

    return { results, suggestions };
  } catch (error) {
    console.error('Google Search API error:', error);
    throw error;
  }
}

// Brave Search API
async function searchBrave(query: string, options?: SearchOptions): Promise<{ results: SearchResult[]; suggestions: string[] }> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    throw new Error('Brave Search API key not configured');
  }

  try {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      },
      params: {
        q: query,
        count: 20,
        ...(options?.language && { search_lang: options.language }),
        ...(options?.pageno && { offset: (options.pageno - 1) * 20 })
      }
    });

    const results: SearchResult[] = response.data.web?.results?.map((item: any) => ({
      title: item.title,
      url: item.url,
      content: item.description,
      thumbnail_src: item.thumbnail?.src,
    })) || [];

    const suggestions: string[] = response.data.query?.altered ? [response.data.query.altered] : [];

    return { results, suggestions };
  } catch (error) {
    console.error('Brave Search API error:', error);
    throw error;
  }
}

// Unified search function with fallback support
export async function performWebSearch(
  query: string,
  options?: SearchOptions
): Promise<{ results: SearchResult[]; suggestions: string[] }> {
  // First try SearXNG if configured
  try {
    return await searchSearxng(query, options);
  } catch (searxngError) {
    console.log('SearXNG not available, trying alternative search providers...');
  }

  // Try Google Search
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      return await searchGoogle(query, options);
    } catch (googleError) {
      console.error('Google Search failed:', googleError);
    }
  }

  // Try Brave Search
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      return await searchBrave(query, options);
    } catch (braveError) {
      console.error('Brave Search failed:', braveError);
    }
  }

  // If all search providers fail, return empty results
  console.error('All search providers failed');
  return { results: [], suggestions: [] };
}

// Export individual search functions for specific use cases
export { searchGoogle, searchBrave };