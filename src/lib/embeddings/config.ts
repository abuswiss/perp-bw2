// Embedding Configuration for BenchWise/Perplexica
// This file standardizes embedding dimensions across the application

export interface EmbeddingModelConfig {
  provider: string;
  model: string;
  dimensions: number;
  description: string;
  cost?: number; // Cost per 1M tokens
}

// Standardized embedding dimension for the application
export const STANDARD_EMBEDDING_DIMENSION = 1536;

// Supported embedding models with their dimensions
export const EMBEDDING_MODELS: Record<string, EmbeddingModelConfig> = {
  // OpenAI Models
  'openai-text-embedding-3-small': {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536, // Default and our standard
    description: 'OpenAI text-embedding-3-small - Cost effective with good performance',
    cost: 0.02 // per 1M tokens
  },
  'openai-text-embedding-3-large': {
    provider: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 1536, // We'll configure it to use 1536 instead of default 3072
    description: 'OpenAI text-embedding-3-large - Higher accuracy, configured for 1536 dimensions',
    cost: 0.13 // per 1M tokens
  },
  
  // Gemini Models
  'gemini-text-embedding-004': {
    provider: 'gemini',
    model: 'models/text-embedding-004',
    dimensions: 768, // Gemini default - will need dimension reduction
    description: 'Google Gemini text-embedding-004',
    cost: 0.00001 // per 1K characters
  },
  
  // Transformers Models (local)
  'transformers-all-MiniLM-L6-v2': {
    provider: 'transformers',
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384, // MiniLM default - will need dimension mapping
    description: 'Local transformer model - fast but lower dimensions',
    cost: 0 // Free local model
  },
  'transformers-bge-small-en': {
    provider: 'transformers',
    model: 'Xenova/bge-small-en-v1.5',
    dimensions: 384, // BGE small default
    description: 'Local BGE small model - good for English text',
    cost: 0 // Free local model
  }
};

// Default embedding model
export const DEFAULT_EMBEDDING_MODEL = 'openai-text-embedding-3-small';

// Get embedding configuration for a model
export function getEmbeddingConfig(modelKey: string): EmbeddingModelConfig | null {
  return EMBEDDING_MODELS[modelKey] || null;
}

// Check if a model outputs the standard dimension
export function isStandardDimension(modelKey: string): boolean {
  const config = getEmbeddingConfig(modelKey);
  return config ? config.dimensions === STANDARD_EMBEDDING_DIMENSION : false;
}

// Configuration for OpenAI models to use specific dimensions
export function getOpenAIEmbeddingConfig(model: string) {
  if (model === 'text-embedding-3-large') {
    // Configure to use 1536 dimensions instead of default 3072
    return {
      model,
      dimensions: STANDARD_EMBEDDING_DIMENSION
    };
  }
  // text-embedding-3-small already defaults to 1536
  return { model };
}

// Dimension reduction strategies for non-standard models
export enum DimensionReductionStrategy {
  PADDING = 'padding', // Pad with zeros to reach target dimension
  PCA = 'pca', // Principal Component Analysis
  TRUNCATE = 'truncate', // Simple truncation (not recommended)
  LINEAR_PROJECTION = 'linear_projection' // Linear transformation matrix
}

// Get recommended dimension reduction strategy for a model
export function getRecommendedReductionStrategy(modelKey: string): DimensionReductionStrategy {
  const config = getEmbeddingConfig(modelKey);
  if (!config) return DimensionReductionStrategy.PADDING;
  
  if (config.dimensions < STANDARD_EMBEDDING_DIMENSION) {
    // For smaller dimensions, padding is simple and effective
    return DimensionReductionStrategy.PADDING;
  } else if (config.dimensions > STANDARD_EMBEDDING_DIMENSION) {
    // For larger dimensions, use linear projection to preserve information
    return DimensionReductionStrategy.LINEAR_PROJECTION;
  }
  
  return DimensionReductionStrategy.PADDING;
}