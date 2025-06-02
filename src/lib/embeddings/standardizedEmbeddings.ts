// Standardized Embeddings Wrapper
// Ensures all embeddings are transformed to standard dimension (1536)

// @ts-nocheck
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { 
  STANDARD_EMBEDDING_DIMENSION, 
  getEmbeddingConfig, 
  getOpenAIEmbeddingConfig,
  getRecommendedReductionStrategy,
  EMBEDDING_MODELS
} from './config';
import { 
  transformToStandardDimension, 
  batchTransformToStandardDimension,
  validateEmbeddingDimensions 
} from './dimensionTransform';

export interface StandardizedEmbeddingsConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

/**
 * Wrapper class that ensures all embeddings are standardized to 1536 dimensions
 */
export class StandardizedEmbeddings extends Embeddings {
  private baseEmbeddings: Embeddings;
  private modelKey: string;
  private sourceDimension: number;
  private reductionStrategy: any;

  constructor(config: StandardizedEmbeddingsConfig) {
    super({});
    
    // Create model key for lookup
    this.modelKey = `${config.provider}-${config.model.replace('/', '-')}`;
    
    // Get model configuration
    const modelConfig = getEmbeddingConfig(this.modelKey);
    if (!modelConfig) {
      console.warn(`Unknown embedding model: ${this.modelKey}, assuming standard dimensions`);
      this.sourceDimension = STANDARD_EMBEDDING_DIMENSION;
    } else {
      this.sourceDimension = modelConfig.dimensions;
    }
    
    // Get reduction strategy
    this.reductionStrategy = getRecommendedReductionStrategy(this.modelKey);
    
    console.log(`StandardizedEmbeddings initialized:`, {
      modelKey: this.modelKey,
      sourceDimension: this.sourceDimension,
      targetDimension: STANDARD_EMBEDDING_DIMENSION,
      reductionStrategy: this.reductionStrategy
    });
    
    // Initialize base embeddings based on provider
    this.baseEmbeddings = this.createBaseEmbeddings(config);
  }

  private createBaseEmbeddings(config: StandardizedEmbeddingsConfig): Embeddings {
    switch (config.provider) {
      case 'openai':
        const openaiConfig = getOpenAIEmbeddingConfig(config.model);
        return new OpenAIEmbeddings({
          openAIApiKey: config.apiKey,
          modelName: openaiConfig.model,
          dimensions: openaiConfig.dimensions, // Force 1536 for text-embedding-3-large
        });
      
      case 'gemini':
        return new GoogleGenerativeAIEmbeddings({
          apiKey: config.apiKey,
          modelName: config.model,
        });
      
      case 'transformers':
        return new HuggingFaceTransformersEmbeddings({
          modelName: config.model,
        });
      
      case 'ollama':
        return new OllamaEmbeddings({
          model: config.model,
          baseUrl: config.baseURL || 'http://localhost:11434',
        });
      
      default:
        console.warn(`Unknown provider ${config.provider}, attempting to use OpenAI`);
        return new OpenAIEmbeddings({
          openAIApiKey: config.apiKey,
          modelName: 'text-embedding-3-small',
        });
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    // Get embeddings from base model
    const embeddings = await this.baseEmbeddings.embedDocuments(documents);
    
    console.log(`Base embeddings generated: ${embeddings.length} documents`);
    if (embeddings.length > 0 && embeddings[0]) {
      console.log(`Base embedding dimension: ${embeddings[0].length} (expected source: ${this.sourceDimension})`);
    }
    
    // If already standard dimension, return as-is
    if (this.sourceDimension === STANDARD_EMBEDDING_DIMENSION) {
      return embeddings;
    }
    
    // Transform to standard dimension
    console.log(`Transforming embeddings from ${this.sourceDimension} to ${STANDARD_EMBEDDING_DIMENSION} dimensions`);
    return batchTransformToStandardDimension(
      embeddings,
      this.sourceDimension,
      this.reductionStrategy
    );
  }

  async embedQuery(document: string): Promise<number[]> {
    // Get embedding from base model
    const embedding = await this.baseEmbeddings.embedQuery(document);
    
    // If already standard dimension, return as-is
    if (this.sourceDimension === STANDARD_EMBEDDING_DIMENSION) {
      return embedding;
    }
    
    // Transform to standard dimension
    return transformToStandardDimension(
      embedding,
      this.sourceDimension,
      this.reductionStrategy
    );
  }

  /**
   * Validate that embeddings match expected dimensions
   */
  static validateEmbeddings(embeddings: number[] | number[][]): boolean {
    if (Array.isArray(embeddings[0])) {
      // Batch of embeddings
      return (embeddings as number[][]).every(emb => validateEmbeddingDimensions(emb));
    } else {
      // Single embedding
      return validateEmbeddingDimensions(embeddings as number[]);
    }
  }

  /**
   * Get information about the model being used
   */
  getModelInfo() {
    return {
      modelKey: this.modelKey,
      sourceDimension: this.sourceDimension,
      targetDimension: STANDARD_EMBEDDING_DIMENSION,
      reductionStrategy: this.reductionStrategy,
      requiresTransformation: this.sourceDimension !== STANDARD_EMBEDDING_DIMENSION
    };
  }
}

/**
 * Factory function to create standardized embeddings
 */
export async function createStandardizedEmbeddings(
  provider: string,
  model: string,
  apiKey?: string,
  baseURL?: string
): Promise<StandardizedEmbeddings> {
  const config: StandardizedEmbeddingsConfig = {
    provider,
    model,
    apiKey,
    baseURL
  };
  
  return new StandardizedEmbeddings(config);
}

/**
 * Get recommended embedding model based on requirements
 */
export function getRecommendedEmbeddingModel(requirements?: {
  costSensitive?: boolean;
  highAccuracy?: boolean;
  localOnly?: boolean;
}): string {
  if (requirements?.localOnly) {
    return 'transformers-bge-small-en';
  }
  
  if (requirements?.highAccuracy) {
    return 'openai-text-embedding-3-large';
  }
  
  // Default: balance of cost and performance
  return 'openai-text-embedding-3-small';
}