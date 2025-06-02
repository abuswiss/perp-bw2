import {
  getAnthropicApiKey,
  getCustomOpenaiApiKey,
  getCustomOpenaiApiUrl,
  getCustomOpenaiModelName,
  getGeminiApiKey,
  getGroqApiKey,
  getOllamaApiEndpoint,
  getOpenaiApiKey,
  getDeepseekApiKey,
  getLMStudioApiEndpoint,
  updateConfig,
} from '@/lib/config';
import {
  getAvailableChatModelProviders,
  getAvailableEmbeddingModelProviders,
} from '@/lib/providers';

// Cache to prevent slow reloading
let cachedConfig: Record<string, any> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30000; // 30 seconds cache

export const GET = async (req: Request) => {
  try {
    // Return cached config if still valid
    const now = Date.now();
    if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL) {
      return Response.json({ ...cachedConfig }, { status: 200 });
    }

    const config: Record<string, any> = {};

    // Use Promise.allSettled to prevent one provider failure from blocking others
    // Add timeout to prevent hanging on slow network calls
    const [chatProvidersResult, embeddingProvidersResult] = await Promise.allSettled([
      Promise.race([
        getAvailableChatModelProviders(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Chat providers timeout')), 10000)
        )
      ]),
      Promise.race([
        getAvailableEmbeddingModelProviders(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Embedding providers timeout')), 10000)
        )
      ])
    ]);

    // Handle chat model providers
    const chatModelProviders = chatProvidersResult.status === 'fulfilled' 
      ? chatProvidersResult.value as Record<string, any>
      : {};
    
    // Handle embedding model providers  
    const embeddingModelProviders = embeddingProvidersResult.status === 'fulfilled'
      ? embeddingProvidersResult.value as Record<string, any>
      : {};

    // Log any provider failures for debugging
    if (chatProvidersResult.status === 'rejected') {
      console.warn('Chat providers failed to load:', chatProvidersResult.reason);
    }
    if (embeddingProvidersResult.status === 'rejected') {
      console.warn('Embedding providers failed to load:', embeddingProvidersResult.reason);
    }

    config['chatModelProviders'] = {};
    config['embeddingModelProviders'] = {};

    for (const provider in chatModelProviders) {
      config['chatModelProviders'][provider] = Object.keys(
        chatModelProviders[provider],
      ).map((model) => {
        return {
          name: model,
          displayName: chatModelProviders[provider][model].displayName,
        };
      });
    }

    for (const provider in embeddingModelProviders) {
      config['embeddingModelProviders'][provider] = Object.keys(
        embeddingModelProviders[provider],
      ).map((model) => {
        return {
          name: model,
          displayName: embeddingModelProviders[provider][model].displayName,
        };
      });
    }

    config['openaiApiKey'] = getOpenaiApiKey();
    config['ollamaApiUrl'] = getOllamaApiEndpoint();
    config['lmStudioApiUrl'] = getLMStudioApiEndpoint();
    config['anthropicApiKey'] = getAnthropicApiKey();
    config['groqApiKey'] = getGroqApiKey();
    config['geminiApiKey'] = getGeminiApiKey();
    config['deepseekApiKey'] = getDeepseekApiKey();
    config['customOpenaiApiUrl'] = getCustomOpenaiApiUrl();
    config['customOpenaiApiKey'] = getCustomOpenaiApiKey();
    config['customOpenaiModelName'] = getCustomOpenaiModelName();

    // Cache the result
    cachedConfig = config;
    cacheTimestamp = Date.now();

    return Response.json({ ...config }, { status: 200 });
  } catch (err) {
    console.error('An error occurred while getting config:', err);
    return Response.json(
      { message: 'An error occurred while getting config' },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    // Invalidate cache when config is updated
    cachedConfig = null;
    cacheTimestamp = 0;
    
    const config = await req.json();

    const updatedConfig = {
      MODELS: {
        OPENAI: {
          API_KEY: config.openaiApiKey,
        },
        GROQ: {
          API_KEY: config.groqApiKey,
        },
        ANTHROPIC: {
          API_KEY: config.anthropicApiKey,
        },
        GEMINI: {
          API_KEY: config.geminiApiKey,
        },
        OLLAMA: {
          API_URL: config.ollamaApiUrl,
        },
        DEEPSEEK: {
          API_KEY: config.deepseekApiKey,
        },
        LM_STUDIO: {
          API_URL: config.lmStudioApiUrl,
        },
        CUSTOM_OPENAI: {
          API_URL: config.customOpenaiApiUrl,
          API_KEY: config.customOpenaiApiKey,
          MODEL_NAME: config.customOpenaiModelName,
        },
      },
    };

    updateConfig(updatedConfig);

    return Response.json({ message: 'Config updated' }, { status: 200 });
  } catch (err) {
    console.error('An error occurred while updating config:', err);
    return Response.json(
      { message: 'An error occurred while updating config' },
      { status: 500 },
    );
  }
};
