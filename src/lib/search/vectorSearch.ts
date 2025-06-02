// Vector search utilities for standardized embeddings
import { supabaseAdmin } from '@/lib/supabase/client';
import { StandardizedEmbeddings } from '@/lib/embeddings/standardizedEmbeddings';
import { STANDARD_EMBEDDING_DIMENSION } from '@/lib/embeddings/config';
import computeSimilarity from '@/lib/utils/computeSimilarity';

export interface VectorSearchOptions {
  matterId?: string | null;
  limit?: number;
  threshold?: number; // Minimum similarity threshold (0-1)
  includeContent?: boolean;
  includeMetadata?: boolean;
}

export interface VectorSearchResult {
  id: string;
  documentId: string;
  content?: string;
  similarity: number;
  metadata?: any;
  documentName?: string;
  chunkIndex?: number;
}

/**
 * Search document chunks using vector similarity
 */
export async function searchDocumentChunks(
  query: string,
  embeddings: StandardizedEmbeddings,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  const {
    matterId = null,
    limit = 10,
    threshold = 0.7,
    includeContent = true,
    includeMetadata = false
  } = options;

  try {
    // Generate query embedding
    console.log('Generating query embedding...');
    const queryEmbedding = await embeddings.embedQuery(query);
    
    // Validate embedding dimension
    if (queryEmbedding.length !== STANDARD_EMBEDDING_DIMENSION) {
      throw new Error(`Invalid query embedding dimension: ${queryEmbedding.length}`);
    }

    // Use Supabase function for vector search
    const { data, error } = await supabaseAdmin
      .rpc('search_document_chunks', {
        query_embedding: queryEmbedding,
        match_count: limit * 2, // Get more results to filter by threshold
        filter_matter_id: matterId
      });

    if (error) {
      console.error('Vector search error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No results found');
      return [];
    }

    // Filter by similarity threshold and get additional data if needed
    const results: VectorSearchResult[] = [];
    
    for (const chunk of data) {
      if (chunk.similarity < threshold) continue;
      
      const result: VectorSearchResult = {
        id: chunk.id,
        documentId: chunk.document_id,
        similarity: chunk.similarity,
        content: includeContent ? chunk.content : undefined
      };

      // Get additional document info if needed
      if (includeMetadata || !includeContent) {
        const { data: docData } = await supabaseAdmin
          .from('documents')
          .select('filename, metadata')
          .eq('id', chunk.document_id)
          .single();
        
        if (docData) {
          result.documentName = docData.filename;
          if (includeMetadata) {
            result.metadata = docData.metadata;
          }
        }
      }

      // Get chunk metadata if needed
      if (includeMetadata) {
        const { data: chunkData } = await supabaseAdmin
          .from('document_chunks')
          .select('chunk_index, metadata')
          .eq('id', chunk.id)
          .single();
        
        if (chunkData) {
          result.chunkIndex = chunkData.chunk_index;
          result.metadata = { ...result.metadata, ...chunkData.metadata };
        }
      }

      results.push(result);
      
      if (results.length >= limit) break;
    }

    console.log(`Found ${results.length} chunks above threshold ${threshold}`);
    return results;

  } catch (error) {
    console.error('Error in searchDocumentChunks:', error);
    throw error;
  }
}

/**
 * Search for similar documents based on a document chunk
 */
export async function findSimilarDocuments(
  chunkId: string,
  options: VectorSearchOptions = {}
): Promise<VectorSearchResult[]> {
  try {
    // Get the chunk's embedding
    const { data: chunk, error } = await supabaseAdmin
      .from('document_chunks')
      .select('embedding, document_id, content')
      .eq('id', chunkId)
      .single();

    if (error || !chunk) {
      throw new Error('Chunk not found');
    }

    if (!chunk.embedding || chunk.embedding.length !== STANDARD_EMBEDDING_DIMENSION) {
      throw new Error('Invalid chunk embedding');
    }

    // Use the embedding for similarity search
    const { data: similar, error: searchError } = await supabaseAdmin
      .rpc('search_document_chunks', {
        query_embedding: chunk.embedding,
        match_count: (options.limit || 10) + 1, // +1 to exclude self
        filter_matter_id: options.matterId
      });

    if (searchError) {
      throw searchError;
    }

    // Filter out the original chunk and apply threshold
    const results = similar
      .filter((s: any) => s.id !== chunkId && s.similarity >= (options.threshold || 0.7))
      .slice(0, options.limit || 10)
      .map((s: any) => ({
        id: s.id,
        documentId: s.document_id,
        content: options.includeContent ? s.content : undefined,
        similarity: s.similarity
      }));

    return results;

  } catch (error) {
    console.error('Error in findSimilarDocuments:', error);
    throw error;
  }
}

/**
 * Hybrid search combining vector similarity and keyword matching
 */
export async function hybridSearch(
  query: string,
  embeddings: StandardizedEmbeddings,
  options: VectorSearchOptions & { keywords?: string[] } = {}
): Promise<VectorSearchResult[]> {
  try {
    // Get vector search results
    const vectorResults = await searchDocumentChunks(query, embeddings, {
      ...options,
      limit: (options.limit || 10) * 2, // Get more for re-ranking
      threshold: (options.threshold || 0.7) * 0.8 // Lower threshold for hybrid
    });

    if (!options.keywords || options.keywords.length === 0) {
      return vectorResults.slice(0, options.limit || 10);
    }

    // Re-rank based on keyword matches
    const rerankedResults = vectorResults.map(result => {
      let keywordScore = 0;
      const content = result.content?.toLowerCase() || '';
      
      for (const keyword of options.keywords!) {
        if (content.includes(keyword.toLowerCase())) {
          keywordScore += 0.1; // Boost for each keyword match
        }
      }

      return {
        ...result,
        similarity: Math.min(1, result.similarity + keywordScore)
      };
    });

    // Sort by combined score and return top results
    return rerankedResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit || 10);

  } catch (error) {
    console.error('Error in hybridSearch:', error);
    throw error;
  }
}

/**
 * Get embeddings for all chunks in a document
 */
export async function getDocumentEmbeddings(
  documentId: string
): Promise<{ chunkId: string; embedding: number[]; content: string }[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('document_chunks')
      .select('id, embedding, content')
      .eq('document_id', documentId)
      .order('chunk_index');

    if (error) {
      throw error;
    }

    return (data || []).map(chunk => ({
      chunkId: chunk.id,
      embedding: chunk.embedding || [],
      content: chunk.content
    }));

  } catch (error) {
    console.error('Error in getDocumentEmbeddings:', error);
    throw error;
  }
}

/**
 * Compute document-level similarity between two documents
 */
export async function computeDocumentSimilarity(
  documentId1: string,
  documentId2: string
): Promise<number> {
  try {
    const [embeddings1, embeddings2] = await Promise.all([
      getDocumentEmbeddings(documentId1),
      getDocumentEmbeddings(documentId2)
    ]);

    if (embeddings1.length === 0 || embeddings2.length === 0) {
      return 0;
    }

    // Compute average embedding for each document
    const avgEmbedding1 = averageEmbeddings(embeddings1.map(e => e.embedding));
    const avgEmbedding2 = averageEmbeddings(embeddings2.map(e => e.embedding));

    // Compute similarity
    return computeSimilarity(avgEmbedding1, avgEmbedding2);

  } catch (error) {
    console.error('Error in computeDocumentSimilarity:', error);
    return 0;
  }
}

/**
 * Helper function to compute average of multiple embeddings
 */
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  
  const avgEmbedding = new Array(STANDARD_EMBEDDING_DIMENSION).fill(0);
  
  for (const embedding of embeddings) {
    for (let i = 0; i < STANDARD_EMBEDDING_DIMENSION; i++) {
      avgEmbedding[i] += (embedding[i] || 0) / embeddings.length;
    }
  }
  
  return avgEmbedding;
}