import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
}

export class AnthropicError extends AppError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode, true, 'ANTHROPIC_ERROR');
  }
}

export class AnthropicService {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor() {
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    });
    
    this.defaultModel = env.ANTHROPIC_MODEL;
    this.defaultMaxTokens = env.ANTHROPIC_MAX_TOKENS;
    this.defaultTemperature = env.ANTHROPIC_TEMPERATURE;
    
    logger.info('Anthropic service initialized', {
      model: this.defaultModel,
      maxTokens: this.defaultMaxTokens,
      temperature: this.defaultTemperature,
    });
  }

  /**
   * Convert messages to Anthropic format
   */
  private formatMessages(messages: ChatMessage[]): { system?: string; messages: Anthropic.MessageParam[] } {
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    return {
      system: systemMessage?.content,
      messages: conversationMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    };
  }

  /**
   * Create a chat completion
   */
  async createChatCompletion(
    messages: ChatMessage[],
    options: ChatCompletionOptions = {}
  ) {
    try {
      const { system, messages: formattedMessages } = this.formatMessages(messages);
      
      const params: Anthropic.MessageCreateParams = {
        model: options.model || this.defaultModel,
        messages: formattedMessages,
        max_tokens: options.maxTokens ?? this.defaultMaxTokens,
        temperature: options.temperature ?? this.defaultTemperature,
        top_p: options.topP,
        top_k: options.topK,
        system,
      };

      logger.debug('Creating chat completion', {
        model: params.model,
        messageCount: formattedMessages.length,
        hasSystem: !!system,
      });

      const response = await this.client.messages.create(params);
      
      logger.info('Chat completion created successfully', {
        model: params.model,
        usage: response.usage,
        stopReason: response.stop_reason,
      });

      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        model: response.model,
        finishReason: response.stop_reason,
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
      const { system, messages: formattedMessages } = this.formatMessages(messages);
      
      const params: Anthropic.MessageStreamParams = {
        model: options.model || this.defaultModel,
        messages: formattedMessages,
        max_tokens: options.maxTokens ?? this.defaultMaxTokens,
        temperature: options.temperature ?? this.defaultTemperature,
        top_p: options.topP,
        top_k: options.topK,
        system,
        stream: true,
      };

      logger.debug('Creating streaming chat completion', {
        model: params.model,
        messageCount: formattedMessages.length,
        hasSystem: !!system,
      });

      const stream = await this.client.messages.create(params);
      
      return stream;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // Make a minimal request to validate the API key
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      
      logger.info('Anthropic API key validated successfully');
      return true;
    } catch (error) {
      logger.error('Anthropic API key validation failed', { error });
      return false;
    }
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    // Anthropic doesn't have a models endpoint, so we return a static list
    const models = [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutput: 4096,
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        contextWindow: 200000,
        maxOutput: 4096,
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        contextWindow: 200000,
        maxOutput: 4096,
      },
      {
        id: 'claude-2.1',
        name: 'Claude 2.1',
        contextWindow: 200000,
        maxOutput: 4096,
      },
      {
        id: 'claude-2.0',
        name: 'Claude 2.0',
        contextWindow: 100000,
        maxOutput: 4096,
      },
    ];
    
    logger.info('Retrieved available models', { count: models.length });
    
    return models;
  }

  /**
   * Calculate token count for messages (approximation)
   */
  estimateTokenCount(messages: ChatMessage[]): number {
    // Anthropic uses a similar tokenization to OpenAI
    // This is a rough approximation. For accurate counting, use Anthropic's tokenizer
    const text = messages.map(m => m.content).join(' ');
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Handle Anthropic API errors
   */
  private handleError(error: any): never {
    logger.error('Anthropic API error', { error });

    if (error instanceof Anthropic.APIError) {
      const message = error.message || 'Anthropic API error occurred';
      
      switch (error.status) {
        case 401:
          throw new AnthropicError('Invalid API key', 401);
        case 429:
          throw new AnthropicError('Rate limit exceeded. Please try again later.', 429);
        case 500:
        case 502:
        case 503:
          throw new AnthropicError('Anthropic service is temporarily unavailable', 503);
        case 400:
          if (error.message?.includes('credit')) {
            throw new AnthropicError('Insufficient credits. Please add credits to your account.', 402);
          }
          throw new AnthropicError(message, 400);
        default:
          throw new AnthropicError(message, error.status || 500);
      }
    }

    if (error instanceof Error) {
      throw new AnthropicError(error.message);
    }

    throw new AnthropicError('An unexpected error occurred');
  }
}

// Export singleton instance
export const anthropicService = new AnthropicService();