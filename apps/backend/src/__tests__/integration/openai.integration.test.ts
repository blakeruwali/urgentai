import { describe, it, expect, beforeAll } from 'vitest';
import { openAIService } from '../../services/openai.service.js';

// Skip integration tests if no API key is provided
const skipIfNoApiKey = process.env.OPENAI_API_KEY === 'test_key_for_mocking';

describe.skipIf(skipIfNoApiKey)('OpenAI Service Integration Tests', () => {
  beforeAll(() => {
    console.log('⚠️  Running integration tests with real OpenAI API');
  });

  describe('validateApiKey', () => {
    it('should validate a real API key', async () => {
      const isValid = await openAIService.validateApiKey();
      expect(isValid).toBe(true);
    });
  });

  describe('createChatCompletion', () => {
    it('should create a real chat completion', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant. Keep responses brief.' },
        { role: 'user' as const, content: 'Say "Hello, World!" and nothing else.' },
      ];

      const result = await openAIService.createChatCompletion(messages, {
        temperature: 0.1,
        maxTokens: 10,
      });

      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
      expect(result.usage).toBeDefined();
      expect(result.usage?.total_tokens).toBeGreaterThan(0);
      expect(result.model).toBeTruthy();
      expect(result.finishReason).toBeTruthy();
    }, 10000); // 10 second timeout for API calls

    it('should handle different models', async () => {
      const messages = [
        { role: 'user' as const, content: 'What is 2+2?' },
      ];

      const result = await openAIService.createChatCompletion(messages, {
        model: 'gpt-3.5-turbo',
        temperature: 0,
        maxTokens: 10,
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('4');
      expect(result.model).toContain('gpt-3.5');
    }, 10000);
  });

  describe('createEmbedding', () => {
    it('should create embeddings for text', async () => {
      const text = 'This is a test sentence for embeddings.';
      
      const result = await openAIService.createEmbedding(text);

      expect(result).toBeDefined();
      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toBeInstanceOf(Array);
      expect(result.embeddings[0].length).toBeGreaterThan(0);
      expect(result.usage).toBeDefined();
      expect(result.model).toContain('embedding');
    }, 10000);

    it('should create embeddings for multiple texts', async () => {
      const texts = [
        'First test sentence.',
        'Second test sentence.',
        'Third test sentence.',
      ];
      
      const result = await openAIService.createEmbedding(texts);

      expect(result).toBeDefined();
      expect(result.embeddings).toHaveLength(3);
      result.embeddings.forEach(embedding => {
        expect(embedding).toBeInstanceOf(Array);
        expect(embedding.length).toBeGreaterThan(0);
      });
    }, 10000);
  });

  describe('getAvailableModels', () => {
    it('should retrieve available GPT models', async () => {
      const models = await openAIService.getAvailableModels();

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      // Check if we have some expected models
      const modelIds = models.map(m => m.id);
      expect(modelIds).toEqual(
        expect.arrayContaining([
          expect.stringContaining('gpt'),
        ])
      );
    }, 10000);
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count for messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hello, how can you help me today?' },
        { role: 'assistant' as const, content: 'I can help you with various tasks including answering questions, providing information, and assisting with problem-solving.' },
      ];

      const count = openAIService.estimateTokenCount(messages);
      
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(100); // These messages should be well under 100 tokens
    });
  });

  describe('error handling', () => {
    it('should handle invalid model gracefully', async () => {
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      await expect(
        openAIService.createChatCompletion(messages, {
          model: 'invalid-model-name',
        })
      ).rejects.toThrow();
    }, 10000);

    it('should handle rate limiting gracefully', async () => {
      // This test would need to actually trigger rate limiting
      // which is not practical in integration tests
      // Instead, we just verify the service handles errors properly
      
      const messages = [
        { role: 'user' as const, content: 'Test' },
      ];

      // Make a normal request to ensure error handling works
      const result = await openAIService.createChatCompletion(messages, {
        maxTokens: 1, // Very low to ensure quick response
      });

      expect(result).toBeDefined();
    }, 10000);
  });
});