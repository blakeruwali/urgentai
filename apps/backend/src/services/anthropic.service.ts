import Anthropic from '@anthropic-ai/sdk';
import { 
  ClaudeRequest, 
  ClaudeResponse, 
  AnthropicErrorType, 
  ModelConfig,
  StreamingResponse,
  Message
} from '../types/anthropic.types';

// Custom error class - defined here to avoid import conflict
class AnthropicError extends Error {
  constructor(
    message: string,
    public type: AnthropicErrorType,
    public code?: string,
    public retryAfter?: number,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

export class AnthropicService {
  private client: Anthropic | null = null;
  private modelConfig: ModelConfig | null = null;

  private initialize() {
    if (this.client) return; // Already initialized

    // Validate API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: apiKey,
      timeout: 30000,
      maxRetries: 3,
    });

    // Default model configuration
    this.modelConfig = {
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4096'),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
      system: "You are an AI assistant specialized in app development. You help users create applications through natural conversation, generating clean, modern code with best practices. You're knowledgeable about React, TypeScript, Node.js, and modern web development tools.",
      timeout: 30000,
      maxRetries: 3
    };

    console.log('✅ Anthropic service initialized with model:', this.modelConfig.model);
  }

  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(request: ClaudeRequest): Promise<ClaudeResponse> {
    this.initialize(); // Ensure service is initialized
    
    const startTime = Date.now();

    try {
      // Validate request
      this.validateRequest(request);

      // Prepare messages for Anthropic API
      const messages = this.formatMessages(request.messages);

      // Make API call
      const response = await this.client!.messages.create({
        model: request.options?.model || this.modelConfig!.model,
        max_tokens: request.options?.max_tokens || this.modelConfig!.max_tokens,
        temperature: request.options?.temperature || this.modelConfig!.temperature,
        system: this.modelConfig!.system,
        messages: messages
      });

      const processingTime = Date.now() - startTime;

      // Format response
      const claudeResponse: ClaudeResponse = {
        id: response.id,
        content: this.extractContent(response.content),
        role: 'assistant',
        type: this.detectContentType(response.content),
        metadata: {
          model: response.model,
          tokens_used: response.usage.input_tokens + response.usage.output_tokens,
          finish_reason: response.stop_reason || 'complete',
          processing_time: processingTime
        },
        createdAt: new Date().toISOString()
      };

      // Log successful request
      console.log(`✅ Claude API call successful - Tokens: ${claudeResponse.metadata.tokens_used}, Time: ${processingTime}ms`);

      return claudeResponse;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Claude API call failed:', error);
      throw this.handleError(error, processingTime);
    }
  }

  /**
   * Send a streaming message to Claude
   */
  async sendStreamingMessage(
    request: ClaudeRequest,
    onChunk: (chunk: StreamingResponse) => void
  ): Promise<ClaudeResponse> {
    this.initialize(); // Ensure service is initialized
    
    const startTime = Date.now();

    try {
      this.validateRequest(request);
      const messages = this.formatMessages(request.messages);

      const stream = await this.client!.messages.create({
        model: request.options?.model || this.modelConfig!.model,
        max_tokens: request.options?.max_tokens || this.modelConfig!.max_tokens,
        temperature: request.options?.temperature || this.modelConfig!.temperature,
        system: this.modelConfig!.system,
        messages: messages,
        stream: true
      });

      let fullContent = '';
      let messageId = '';
      let tokensUsed = 0;

      for await (const chunk of stream) {
        if (chunk.type === 'message_start') {
          messageId = chunk.message.id;
          tokensUsed = chunk.message.usage.input_tokens;
        } else if (chunk.type === 'content_block_delta') {
          // Handle text delta properly
          if ('text' in chunk.delta) {
            const deltaText = chunk.delta.text || '';
            fullContent += deltaText;
            
            onChunk({
              id: messageId,
              chunk: deltaText,
              done: false
            });
          }
        } else if (chunk.type === 'message_delta') {
          tokensUsed += chunk.usage.output_tokens;
        } else if (chunk.type === 'message_stop') {
          onChunk({
            id: messageId,
            chunk: '',
            done: true,
            metadata: {
              tokens_generated: tokensUsed,
              finish_reason: 'complete'
            }
          });
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        id: messageId,
        content: fullContent,
        role: 'assistant',
        type: this.detectContentType([{ type: 'text', text: fullContent }]),
        metadata: {
          model: this.modelConfig!.model,
          tokens_used: tokensUsed,
          finish_reason: 'complete',
          processing_time: processingTime
        },
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('❌ Claude streaming API call failed:', error);
      throw this.handleError(error, processingTime);
    }
  }

  /**
   * Validate the request before sending to Claude
   */
  private validateRequest(request: ClaudeRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new AnthropicError('Messages array cannot be empty', AnthropicErrorType.VALIDATION_ERROR);
    }

    if (!request.conversationId) {
      throw new AnthropicError('Conversation ID is required', AnthropicErrorType.VALIDATION_ERROR);
    }

    // Check for empty messages
    const emptyMessages = request.messages.filter(msg => !msg.content?.trim());
    if (emptyMessages.length > 0) {
      throw new AnthropicError('Messages cannot be empty', AnthropicErrorType.VALIDATION_ERROR);
    }
  }

  /**
   * Format messages for Anthropic API
   */
  private formatMessages(messages: Message[]): Array<{ role: 'user' | 'assistant', content: string }> {
    return messages
      .filter(msg => msg.role !== 'system') // System message is handled separately
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
  }

  /**
   * Extract text content from Anthropic response
   */
  private extractContent(content: any[]): string {
    return content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }

  /**
   * Detect if content is code or text
   */
  private detectContentType(content: any[]): 'text' | 'code' {
    const text = this.extractContent(content);
    
    // Simple heuristics to detect code
    const codeIndicators = [
      /```/g,                    // Code blocks
      /import\s+.*from/g,        // ES6 imports
      /function\s+\w+/g,         // Function declarations
      /const\s+\w+\s*=/g,        // Const declarations
      /interface\s+\w+/g,        // TypeScript interfaces
      /class\s+\w+/g,            // Class declarations
      /<[a-zA-Z][^>]*>/g,        // HTML/JSX tags
    ];

    const codeMatches = codeIndicators.reduce((count, pattern) => {
      return count + (text.match(pattern) || []).length;
    }, 0);

    return codeMatches > 2 ? 'code' : 'text';
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any, processingTime: number): AnthropicError {
    console.error(`Error after ${processingTime}ms:`, error);

    if (error instanceof Anthropic.APIError) {
      switch (error.status) {
        case 401:
          return new AnthropicError(
            'Invalid API key',
            AnthropicErrorType.API_KEY_INVALID,
            error.status.toString()
          );
        case 429:
          return new AnthropicError(
            'Rate limit exceeded',
            AnthropicErrorType.RATE_LIMIT_EXCEEDED,
            error.status.toString(),
            this.extractRetryAfter(error)
          );
        case 400:
          if (error.message.includes('token')) {
            return new AnthropicError(
              'Token limit exceeded',
              AnthropicErrorType.TOKEN_LIMIT_EXCEEDED,
              error.status.toString()
            );
          }
          return new AnthropicError(
            'Invalid request',
            AnthropicErrorType.VALIDATION_ERROR,
            error.status.toString()
          );
        case 503:
          return new AnthropicError(
            'Model temporarily unavailable',
            AnthropicErrorType.MODEL_UNAVAILABLE,
            error.status.toString()
          );
        default:
          return new AnthropicError(
            `API error: ${error.message}`,
            AnthropicErrorType.INTERNAL_ERROR,
            error.status?.toString()
          );
      }
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new AnthropicError(
        'Request timeout',
        AnthropicErrorType.TIMEOUT
      );
    }

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return new AnthropicError(
        'Network error',
        AnthropicErrorType.NETWORK_ERROR
      );
    }

    return new AnthropicError(
      error.message || 'Unknown error occurred',
      AnthropicErrorType.INTERNAL_ERROR
    );
  }

  /**
   * Extract retry-after header from rate limit error
   */
  private extractRetryAfter(error: any): number | undefined {
    const retryAfter = error.headers?.['retry-after'];
    return retryAfter ? parseInt(retryAfter) : undefined;
  }

  /**
   * Get current model configuration
   */
  getModelConfig(): ModelConfig {
    this.initialize(); // Ensure service is initialized
    return { ...this.modelConfig! };
  }

  /**
   * Update model configuration
   */
  updateModelConfig(updates: Partial<ModelConfig>): void {
    this.initialize(); // Ensure service is initialized
    this.modelConfig = { ...this.modelConfig!, ...updates };
    console.log('📝 Model configuration updated:', this.modelConfig);
  }
}

// Export singleton instance
export const anthropicService = new AnthropicService(); 