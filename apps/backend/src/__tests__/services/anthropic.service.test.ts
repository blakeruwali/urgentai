import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicService } from '../../services/anthropic.service.js';
import { AnthropicError } from '../../utils/errors.js';

// Mock Anthropic
vi.mock('@anthropic-ai/sdk');

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock env
vi.mock('../../config/env.js', () => ({
  env: {
    ANTHROPIC_API_KEY: 'test-api-key',
    ANTHROPIC_MODEL: 'claude-3-opus-20240229',
    ANTHROPIC_MAX_TOKENS: 1000,
    ANTHROPIC_TEMPERATURE: 0.7,
  },
}));

describe('AnthropicService', () => {
  let service: AnthropicService;
  let mockAnthropicInstance: any;

  beforeEach(() => {
    // Create mock Anthropic instance
    mockAnthropicInstance = {
      messages: {
        create: vi.fn(),
      },
    };

    // Mock Anthropic constructor
    vi.mocked(Anthropic).mockImplementation(() => mockAnthropicInstance as any);
    
    service = new AnthropicService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createChatCompletion', () => {
    it('should create a chat completion successfully', async () => {
      const mockResponse = {
        id: 'msg_123',
        model: 'claude-3-opus-20240229',
        content: [{
          type: 'text',
          text: 'Test response',
        }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      mockAnthropicInstance.messages.create.mockResolvedValueOnce(mockResponse);

      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const result = await service.createChatCompletion(messages);

      expect(result).toEqual({
        content: 'Test response',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
        model: 'claude-3-opus-20240229',
        finishReason: 'end_turn',
      });

      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'You are a helpful assistant',
        temperature: 0.7,
        max_tokens: 1000,
      });
    });

    it('should use custom options when provided', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Custom response' }],
        usage: { input_tokens: 10, output_tokens: 20 },
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
      };

      mockAnthropicInstance.messages.create.mockResolvedValueOnce(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Test' }];
      const options = {
        model: 'claude-3-sonnet-20240229',
        temperature: 0.5,
        maxTokens: 500,
        topP: 0.9,
        topK: 40,
      };

      await service.createChatCompletion(messages, options);

      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        messages,
        temperature: 0.5,
        max_tokens: 500,
        top_p: 0.9,
        top_k: 40,
      });
    });

    it('should handle API errors correctly', async () => {
      const apiError = new Anthropic.APIError(
        429,
        { error: { message: 'Rate limit exceeded' } },
        'Rate limit exceeded',
        {}
      );

      mockAnthropicInstance.messages.create.mockRejectedValueOnce(apiError);

      const messages = [{ role: 'user' as const, content: 'Test' }];

      await expect(service.createChatCompletion(messages))
        .rejects
        .toThrow(AnthropicError);

      await expect(service.createChatCompletion(messages))
        .rejects
        .toThrow('Rate limit exceeded. Please try again later.');
    });

    it('should handle system messages correctly', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 20 },
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
      };

      mockAnthropicInstance.messages.create.mockResolvedValueOnce(mockResponse);

      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'user' as const, content: 'User message' },
        { role: 'assistant' as const, content: 'Assistant response' },
        { role: 'user' as const, content: 'Another user message' },
      ];

      await service.createChatCompletion(messages);

      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        system: 'System prompt',
        messages: [
          { role: 'user', content: 'User message' },
          { role: 'assistant', content: 'Assistant response' },
          { role: 'user', content: 'Another user message' },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
    });
  });

  describe('createStreamingChatCompletion', () => {
    it('should create a streaming chat completion', async () => {
      const mockStream = { [Symbol.asyncIterator]: vi.fn() };
      mockAnthropicInstance.messages.create.mockResolvedValueOnce(mockStream);

      const messages = [{ role: 'user' as const, content: 'Stream test' }];
      
      const result = await service.createStreamingChatCompletion(messages);

      expect(result).toBe(mockStream);
      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockAnthropicInstance.messages.create.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'test' }],
      });

      const result = await service.validateApiKey();

      expect(result).toBe(true);
      expect(mockAnthropicInstance.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
    });

    it('should return false for invalid API key', async () => {
      mockAnthropicInstance.messages.create.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await service.validateApiKey();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return available Claude models', () => {
      const models = service.getAvailableModels();

      expect(models).toHaveLength(5);
      expect(models[0]).toMatchObject({
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        contextWindow: 200000,
        maxOutput: 4096,
      });
      expect(models[1]).toMatchObject({
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
      });
      expect(models[2]).toMatchObject({
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
      });
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count for messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello world' },
      ];

      const count = service.estimateTokenCount(messages);
      
      // "You are helpful" (15 chars) + " " + "Hello world" (11 chars) = 27 chars
      // 27 / 4 = 6.75, rounded up to 7
      expect(count).toBe(7);
    });
  });

  describe('error handling', () => {
    it('should handle 401 errors', async () => {
      const apiError = new Anthropic.APIError(
        401,
        { error: { message: 'Invalid authentication' } },
        'Invalid authentication',
        {}
      );

      mockAnthropicInstance.messages.create.mockRejectedValueOnce(apiError);

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('Invalid API key');
    });

    it('should handle 503 errors', async () => {
      const apiError = new Anthropic.APIError(
        503,
        { error: { message: 'Service unavailable' } },
        'Service unavailable',
        {}
      );

      mockAnthropicInstance.messages.create.mockRejectedValueOnce(apiError);

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('Anthropic service is temporarily unavailable');
    });

    it('should handle credit errors', async () => {
      const apiError = new Anthropic.APIError(
        400,
        { error: { message: 'Your credit balance is too low' } },
        'Your credit balance is too low',
        {}
      );

      mockAnthropicInstance.messages.create.mockRejectedValueOnce(apiError);

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('Insufficient credits. Please add credits to your account.');
    });

    it('should handle generic errors', async () => {
      mockAnthropicInstance.messages.create.mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('Network error');
    });

    it('should handle unknown errors', async () => {
      mockAnthropicInstance.messages.create.mockRejectedValueOnce(
        'Unknown error'
      );

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('An unexpected error occurred');
    });
  });
});