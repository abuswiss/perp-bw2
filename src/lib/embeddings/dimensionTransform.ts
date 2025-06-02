// Dimension transformation utilities for embedding standardization
import { STANDARD_EMBEDDING_DIMENSION, DimensionReductionStrategy } from './config';

/**
 * Transform embeddings to standard dimension (1536)
 */
export function transformToStandardDimension(
  embeddings: number[],
  sourceDimension: number,
  strategy: DimensionReductionStrategy = DimensionReductionStrategy.PADDING
): number[] {
  // If already standard dimension, return as-is
  if (sourceDimension === STANDARD_EMBEDDING_DIMENSION) {
    return embeddings;
  }

  switch (strategy) {
    case DimensionReductionStrategy.PADDING:
      return padEmbeddings(embeddings, sourceDimension);
    
    case DimensionReductionStrategy.TRUNCATE:
      return truncateEmbeddings(embeddings, sourceDimension);
    
    case DimensionReductionStrategy.LINEAR_PROJECTION:
      return linearProjection(embeddings, sourceDimension);
    
    case DimensionReductionStrategy.PCA:
      // PCA requires training data, so fallback to padding for now
      console.warn('PCA not implemented, falling back to padding');
      return padEmbeddings(embeddings, sourceDimension);
    
    default:
      return padEmbeddings(embeddings, sourceDimension);
  }
}

/**
 * Pad embeddings with zeros to reach target dimension
 * Good for smaller embeddings (384, 768) -> 1536
 */
function padEmbeddings(embeddings: number[], sourceDimension: number): number[] {
  if (sourceDimension >= STANDARD_EMBEDDING_DIMENSION) {
    // If source is larger, truncate instead
    return embeddings.slice(0, STANDARD_EMBEDDING_DIMENSION);
  }

  // Pad with zeros
  const padded = new Array(STANDARD_EMBEDDING_DIMENSION).fill(0);
  for (let i = 0; i < embeddings.length && i < STANDARD_EMBEDDING_DIMENSION; i++) {
    padded[i] = embeddings[i];
  }
  
  return padded;
}

/**
 * Simple truncation - only use for dimensions > 1536
 * Not recommended as it loses information
 */
function truncateEmbeddings(embeddings: number[], sourceDimension: number): number[] {
  if (sourceDimension <= STANDARD_EMBEDDING_DIMENSION) {
    return padEmbeddings(embeddings, sourceDimension);
  }
  
  return embeddings.slice(0, STANDARD_EMBEDDING_DIMENSION);
}

/**
 * Linear projection using a simple averaging strategy
 * Better than truncation for dimensions > 1536
 */
function linearProjection(embeddings: number[], sourceDimension: number): number[] {
  if (sourceDimension <= STANDARD_EMBEDDING_DIMENSION) {
    return padEmbeddings(embeddings, sourceDimension);
  }

  // Simple linear projection: average nearby dimensions
  const projected = new Array(STANDARD_EMBEDDING_DIMENSION);
  const ratio = sourceDimension / STANDARD_EMBEDDING_DIMENSION;
  
  for (let i = 0; i < STANDARD_EMBEDDING_DIMENSION; i++) {
    const startIdx = Math.floor(i * ratio);
    const endIdx = Math.floor((i + 1) * ratio);
    
    // Average the values in the source range
    let sum = 0;
    let count = 0;
    for (let j = startIdx; j < endIdx && j < embeddings.length; j++) {
      sum += embeddings[j];
      count++;
    }
    
    projected[i] = count > 0 ? sum / count : 0;
  }
  
  return projected;
}

/**
 * Batch transform embeddings
 */
export function batchTransformToStandardDimension(
  embeddingsBatch: number[][],
  sourceDimension: number,
  strategy: DimensionReductionStrategy = DimensionReductionStrategy.PADDING
): number[][] {
  return embeddingsBatch.map(embeddings => 
    transformToStandardDimension(embeddings, sourceDimension, strategy)
  );
}

/**
 * Validate embedding dimensions
 */
export function validateEmbeddingDimensions(embeddings: number[]): boolean {
  return embeddings.length === STANDARD_EMBEDDING_DIMENSION;
}

/**
 * Get dimension info for debugging
 */
export function getEmbeddingDimensionInfo(embeddings: number[]): {
  currentDimension: number;
  standardDimension: number;
  isStandard: boolean;
  transformationNeeded: boolean;
} {
  const currentDimension = embeddings.length;
  return {
    currentDimension,
    standardDimension: STANDARD_EMBEDDING_DIMENSION,
    isStandard: currentDimension === STANDARD_EMBEDDING_DIMENSION,
    transformationNeeded: currentDimension !== STANDARD_EMBEDDING_DIMENSION
  };
}