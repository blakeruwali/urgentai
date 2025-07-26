import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { OpenAIError } from '../utils/errors.js';
import type { 
  ChatCompletionMessageParam,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming
} from 'openai/resources/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
}

export interface EmbeddingOptions {
  model?: string;
}

export class OpenAIService {
  private client: OpenAI;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    
    this.defaultModel = env.OPENAI_MODEL;
    this.defaultMaxTokens = env.OPENAI_MAX_TOKENS;
    this.defaultTemperature = env.OPENAI_TEMPERATURE;
    
    logger.info('OpenAI service initialized', {
      model: this.defaultModel,
      maxTokens: this.defaultMaxTokens,
      temperature: this.defaultTemperature,
    });
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ) {
    try {
      const params: ChatCompletionCreateParamsNonStreaming = {
        model: options.model || this.defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? this.defaultTemperature,
        max_tokens: options.maxTokens ?? this.defaultMaxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stream: false,
      };

      logger.debug('Creating chat completion', {
        model: params.model,
        messageCount: messages.length,
      });

      const completion = await this.client.chat.completions.create(params);
      
      logger.info('Chat completion created successfully', {
        model: completion.model,
        usage: completion.usage,
        finishReason: completion.choices[0]?.finish_reason,
      });

      return {
        content: completion.choices[0]?.message?.content || '',
        usage: completion.usage,
        model: completion.model,
        finishReason: completion.choices[0]?.finish_reason,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Create a streaming chat completion
   */
  async createStreamingChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ) {
    try {
      const params: ChatCompletionCreateParamsStreaming = {
        model: options.model || this.defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? this.defaultTemperature,
        max_tokens: options.maxTokens ?? this.defaultMaxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stream: true,
      };

      logger.debug('Creating streaming chat completion', {
        model: params.model,
        messageCount: messages.length,
      });

      const stream = await this.client.chat.completions.create(params);
      
      return stream;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Create embeddings for text
   */
  async createEmbedding(
    input: string | string[],
    options: EmbeddingOptions = {}
  ) {
    try {
      const model = options.model || 'text-embedding-ada-002';
      
      logger.debug('Creating embeddings', {
        model,
        inputCount: Array.isArray(input) ? input.length : 1,
      });

      const response = await this.client.embeddings.create({
        model,
        input,
      });

      logger.info('Embeddings created successfully', {
        model: response.model,
        usage: response.usage,
      });

      return {
        embeddings: response.data.map(d => d.embedding),
        usage: response.usage,
        model: response.model,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      logger.info('OpenAI API key validated successfully');
      return true;
    } catch (error) {
      logger.error('OpenAI API key validation failed', { error });
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    try {
      const response = await this.client.models.list();
      const models = response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          created: new Date(model.created * 1000),
          ownedBy: model.owned_by,
        }));
      
      logger.info('Retrieved available models', { count: models.length });
      
      return models;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Calculate token count for messages (approximation)
   */
  estimateTokenCount(messages: ChatMessage[]): number {
    // This is a rough approximation. For accurate counting, use tiktoken library
    const text = messages.map(m => m.content).join(' ');
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Handle OpenAI API errors
   */
  private handleError(error: any): never {
    logger.error('OpenAI API error', { error });

    if (error instanceof OpenAI.APIError) {
      const message = error.message || 'OpenAI API error occurred';
      const statusCode = error.status || 500;
      
      switch (error.status) {
        case 401:
          throw new OpenAIError('Invalid API key', 401);
        case 429:
          throw new OpenAIError('Rate limit exceeded. Please try again later.', 429);
        case 500:
        case 502:
        case 503:
          throw new OpenAIError('OpenAI service is temporarily unavailable', 503);
        default:
          throw new OpenAIError(message, statusCode);
      }
    }

    if (error instanceof Error) {
      throw new OpenAIError(error.message);
    }

    throw new OpenAIError('An unexpected error occurred');
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();