import { Embeddings } from '@langchain/core/embeddings';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  loadOpenAIChatModels,
  loadOpenAIEmbeddingModels,
  PROVIDER_INFO as OpenAIInfo,
  PROVIDER_INFO,
} from './openai';
import {
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
} from '../config';
import { ChatOpenAI } from '@langchain/openai';
import {
  loadOllamaChatModels,
  loadOllamaEmbeddingModels,
  PROVIDER_INFO as OllamaInfo,
} from './ollama';
import { loadGroqChatModels, PROVIDER_INFO as GroqInfo } from './groq';
import {
  loadAnthropicChatModels,
  PROVIDER_INFO as AnthropicInfo,
} from './anthropic';
import {
  loadGeminiChatModels,
  loadGeminiEmbeddingModels,
  PROVIDER_INFO as GeminiInfo,
} from './gemini';
import {
  loadTransformersEmbeddingsModels,
  PROVIDER_INFO as TransformersInfo,
} from './transformers';
import {
  loadDeepseekChatModels,
  PROVIDER_INFO as DeepseekInfo,
} from './deepseek';
import {
  loadLMStudioChatModels,
  loadLMStudioEmbeddingsModels,
  PROVIDER_INFO as LMStudioInfo,
} from './lmstudio';

export const PROVIDER_METADATA = {
  openai: OpenAIInfo,
  ollama: OllamaInfo,
  groq: GroqInfo,
  anthropic: AnthropicInfo,
  gemini: GeminiInfo,
  transformers: TransformersInfo,
  deepseek: DeepseekInfo,
  lmstudio: LMStudioInfo,
  custom_openai: {
    key: 'custom_openai',
    displayName: 'Custom OpenAI',
  },
};

export interface ChatModel {
  displayName: string;
  model: BaseChatModel;
}

export interface EmbeddingModel {
  displayName: string;
  model: Embeddings;
}

export const chatModelProviders: Record<
  string,
  () => Promise<Record<string, ChatModel>>
> = {
  openai: loadOpenAIChatModels,
  ollama: loadOllamaChatModels,
  groq: loadGroqChatModels,
  anthropic: loadAnthropicChatModels,
  gemini: loadGeminiChatModels,
  deepseek: loadDeepseekChatModels,
  lmstudio: loadLMStudioChatModels,
};

export const embeddingModelProviders: Record<
  string,
  () => Promise<Record<string, EmbeddingModel>>
> = {
  openai: loadOpenAIEmbeddingModels,
  ollama: loadOllamaEmbeddingModels,
  gemini: loadGeminiEmbeddingModels,
  transformers: loadTransformersEmbeddingsModels,
  lmstudio: loadLMStudioEmbeddingsModels,
};

export const getAvailableChatModelProviders = async () => {
  const models: Record<string, Record<string, ChatModel>> = {};

  for (const provider in chatModelProviders) {
    const providerModels = await chatModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  const customOpenAiApiKey = getCustomOpenaiApiKey();
  const customOpenAiApiUrl = getCustomOpenaiApiUrl();
  const customOpenAiModelName = getCustomOpenaiModelName();

  models['custom_openai'] = {
    ...(customOpenAiApiKey && customOpenAiApiUrl && customOpenAiModelName
      ? {
          [customOpenAiModelName]: {
            displayName: customOpenAiModelName,
            model: new ChatOpenAI({
              openAIApiKey: customOpenAiApiKey,
              modelName: customOpenAiModelName,
              temperature: 0.7,
              configuration: {
                baseURL: customOpenAiApiUrl,
              },
            }) as unknown as BaseChatModel,
          },
        }
      : {}),
  };

  return models;
};

export const getAvailableEmbeddingModelProviders = async () => {
  const models: Record<string, Record<string, EmbeddingModel>> = {};

  for (const provider in embeddingModelProviders) {
    const providerModels = await embeddingModelProviders[provider]();
    if (Object.keys(providerModels).length > 0) {
      models[provider] = providerModels;
    }
  }

  return models;
};

/**
 * Get o3-mini model specifically for deep research
 */
export const getDeepResearchChatModel = async (): Promise<BaseChatModel | null> => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      console.error('OpenAI API key not found for deep research');
      return getDefaultChatModel(); // Fallback to default
    }
    
    console.log('🧠 Using gpt-4.1 for deep research');
    return new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: 'gpt-4.1',
    }) as unknown as BaseChatModel;
  } catch (error) {
    console.error('Failed to create gpt-4.1 model for deep research:', error);
    return getDefaultChatModel(); // Fallback to default
  }
};

/**
 * Get a default chat model for AI agent use
 * Prefers GPT-4o for legal research and analysis
 */
export const getDefaultChatModel = async (): Promise<BaseChatModel | null> => {
  try {
    const chatModelProviders = await getAvailableChatModelProviders();
    
    // Try custom OpenAI first if configured
    const customOpenAiApiKey = getCustomOpenaiApiKey();
    const customOpenAiApiUrl = getCustomOpenaiApiUrl();
    const customOpenAiModelName = getCustomOpenaiModelName();
    
    if (customOpenAiApiKey && customOpenAiApiUrl && customOpenAiModelName) {
      return new ChatOpenAI({
        modelName: customOpenAiModelName,
        openAIApiKey: customOpenAiApiKey,
        temperature: 0.7,
        configuration: {
          baseURL: customOpenAiApiUrl,
        },
      }) as unknown as BaseChatModel;
    }
    
    // Prefer GPT-4o for legal work if available
    if (chatModelProviders.openai && chatModelProviders.openai['gpt-4o']) {
      console.log('🤖 Using GPT-4o for legal research');
      return chatModelProviders.openai['gpt-4o'].model as BaseChatModel;
    }
    
    // Fallback to GPT-4 turbo if GPT-4o not available
    if (chatModelProviders.openai && chatModelProviders.openai['gpt-4-turbo']) {
      return chatModelProviders.openai['gpt-4-turbo'].model as BaseChatModel;
    }
    
    // Fallback to regular GPT-4 
    if (chatModelProviders.openai && chatModelProviders.openai['gpt-4']) {
      return chatModelProviders.openai['gpt-4'].model as BaseChatModel;
    }
    
    // Last resort: try any available OpenAI model
    if (chatModelProviders.openai) {
      const openaiModels = Object.keys(chatModelProviders.openai);
      if (openaiModels.length > 0) {
        const firstModel = chatModelProviders.openai[openaiModels[0]];
        if (firstModel?.model) {
          return firstModel.model as BaseChatModel;
        }
      }
    }
    
    // Try other providers as final fallback
    for (const [providerKey, provider] of Object.entries(chatModelProviders)) {
      if (providerKey === 'openai') continue; // Already tried above
      const modelKeys = Object.keys(provider);
      if (modelKeys.length > 0) {
        const firstModel = provider[modelKeys[0]];
        if (firstModel?.model) {
          return firstModel.model as BaseChatModel;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get default chat model:', error);
    return null;
  }
};
