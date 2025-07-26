import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import OpenAI from 'openai';
import { OpenAIService } from '../../services/openai.service.js';
import { OpenAIError } from '../../utils/errors.js';

// Mock OpenAI
vi.mock('openai');

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
    OPENAI_API_KEY: 'test-api-key',
    OPENAI_MODEL: 'gpt-4-turbo-preview',
    OPENAI_MAX_TOKENS: 1000,
    OPENAI_TEMPERATURE: 0.7,
  },
}));

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockOpenAIInstance: any;

  beforeEach(() => {
    // Create mock OpenAI instance
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      embeddings: {
        create: vi.fn(),
      },
      models: {
        list: vi.fn(),
      },
    };

    // Mock OpenAI constructor
    vi.mocked(OpenAI).mockImplementation(() => mockOpenAIInstance as any);
    
    service = new OpenAIService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createChatCompletion', () => {
    it('should create a chat completion successfully', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4-turbo-preview',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Test response',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant' },
        { role: 'user' as const, content: 'Hello' },
      ];

      const result = await service.createChatCompletion(messages);

      expect(result).toEqual({
        content: 'Test response',
        usage: mockResponse.usage,
        model: 'gpt-4-turbo-preview',
        finishReason: 'stop',
      });

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      });
    });

    it('should use custom options when provided', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Custom response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        model: 'gpt-3.5-turbo',
      };

      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const messages = [{ role: 'user' as const, content: 'Test' }];
      const options = {
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 500,
        topP: 0.9,
      };

      await service.createChatCompletion(messages, options);

      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.5,
        max_tokens: 500,
        top_p: 0.9,
        stream: false,
      });
    });

    it('should handle API errors correctly', async () => {
      const apiError = new OpenAI.APIError(
        429,
        { error: { message: 'Rate limit exceeded' } },
        'Rate limit exceeded',
        {}
      );

      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(apiError);

      const messages = [{ role: 'user' as const, content: 'Test' }];

      await expect(service.createChatCompletion(messages))
        .rejects
        .toThrow(OpenAIError);

      await expect(service.createChatCompletion(messages))
        .rejects
        .toThrow('Rate limit exceeded. Please try again later.');
    });
  });

  describe('createStreamingChatCompletion', () => {
    it('should create a streaming chat completion', async () => {
      const mockStream = { [Symbol.asyncIterator]: vi.fn() };
      mockOpenAIInstance.chat.completions.create.mockResolvedValueOnce(mockStream);

      const messages = [{ role: 'user' as const, content: 'Stream test' }];
      
      const result = await service.createStreamingChatCompletion(messages);

      expect(result).toBe(mockStream);
      expect(mockOpenAIInstance.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
    });
  });

  describe('createEmbedding', () => {
    it('should create embeddings for single input', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: 'text-embedding-ada-002',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      };

      mockOpenAIInstance.embeddings.create.mockResolvedValueOnce(mockResponse);

      const result = await service.createEmbedding('test input');

      expect(result).toEqual({
        embeddings: [[0.1, 0.2, 0.3]],
        usage: mockResponse.usage,
        model: 'text-embedding-ada-002',
      });

      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: 'test input',
      });
    });

    it('should create embeddings for multiple inputs', async () => {
      const mockResponse = {
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] },
        ],
        model: 'text-embedding-ada-002',
        usage: { prompt_tokens: 10, total_tokens: 10 },
      };

      mockOpenAIInstance.embeddings.create.mockResolvedValueOnce(mockResponse);

      const inputs = ['input 1', 'input 2'];
      const result = await service.createEmbedding(inputs);

      expect(result).toEqual({
        embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        usage: mockResponse.usage,
        model: 'text-embedding-ada-002',
      });
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockOpenAIInstance.models.list.mockResolvedValueOnce({ data: [] });

      const result = await service.validateApiKey();

      expect(result).toBe(true);
      expect(mockOpenAIInstance.models.list).toHaveBeenCalled();
    });

    it('should return false for invalid API key', async () => {
      mockOpenAIInstance.models.list.mockRejectedValueOnce(new Error('Invalid API key'));

      const result = await service.validateApiKey();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return filtered GPT models', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-4', created: 1680000000, owned_by: 'openai' },
          { id: 'gpt-3.5-turbo', created: 1677000000, owned_by: 'openai' },
          { id: 'dall-e-3', created: 1698000000, owned_by: 'openai' },
        ],
      };

      mockOpenAIInstance.models.list.mockResolvedValueOnce(mockModels);

      const result = await service.getAvailableModels();

      expect(result).toHaveLength(2);
      expect(result?.[0]).toMatchObject({
        id: 'gpt-4',
        ownedBy: 'openai',
      });
      expect(result?.[1]).toMatchObject({
        id: 'gpt-3.5-turbo',
        ownedBy: 'openai',
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
      const apiError = new OpenAI.APIError(
        401,
        { error: { message: 'Invalid authentication' } },
        'Invalid authentication',
        {}
      );

      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(apiError);

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('Invalid API key');
    });

    it('should handle 503 errors', async () => {
      const apiError = new OpenAI.APIError(
        503,
        { error: { message: 'Service unavailable' } },
        'Service unavailable',
        {}
      );

      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(apiError);

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('OpenAI service is temporarily unavailable');
    });

    it('should handle generic errors', async () => {
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('Network error');
    });

    it('should handle unknown errors', async () => {
      mockOpenAIInstance.chat.completions.create.mockRejectedValueOnce(
        'Unknown error'
      );

      await expect(service.createChatCompletion([]))
        .rejects
        .toThrow('An unexpected error occurred');
    });
  });
});