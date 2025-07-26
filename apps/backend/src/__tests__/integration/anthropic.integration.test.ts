import { describe, it, expect, beforeAll } from 'vitest';
import { anthropicService } from '../../services/anthropic.service.js';

// Skip integration tests if no API key is provided
const skipIfNoApiKey = process.env.ANTHROPIC_API_KEY === 'test_key_for_mocking';

describe.skipIf(skipIfNoApiKey)('Anthropic Service Integration Tests', () => {
  beforeAll(() => {
    console.log('⚠️  Running integration tests with real Anthropic API');
  });

  describe('validateApiKey', () => {
    it('should validate a real API key', async () => {
      const isValid = await anthropicService.validateApiKey();
      expect(isValid).toBe(true);
    });
  });

  describe('createChatCompletion', () => {
    it('should create a real chat completion', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant. Keep responses brief.' },
        { role: 'user' as const, content: 'Say "Hello, World!" and nothing else.' },
      ];

      const result = await anthropicService.createChatCompletion(messages, {
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
        { role: 'user' as const, content: 'What is 2+2? Answer with just the number.' },
      ];

      const result = await anthropicService.createChatCompletion(messages, {
        model: 'claude-3-haiku-20240307',
        temperature: 0,
        maxTokens: 10,
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('4');
      expect(result.model).toContain('claude-3-haiku');
    }, 10000);

    it('should handle system messages', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are a pirate. Respond in pirate speak.' },
        { role: 'user' as const, content: 'Hello!' },
      ];

      const result = await anthropicService.createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 50,
      });

      expect(result).toBeDefined();
      expect(result.content.toLowerCase()).toMatch(/(ahoy|arr|matey|ye)/);
    }, 10000);
  });

  describe('getAvailableModels', () => {
    it('should retrieve available Claude models', () => {
      const models = anthropicService.getAvailableModels();

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      // Check if we have expected Claude models
      const modelIds = models.map(m => m.id);
      expect(modelIds).toEqual(
        expect.arrayContaining([
          expect.stringContaining('claude'),
        ])
      );

      // Check model properties
      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('contextWindow');
        expect(model).toHaveProperty('maxOutput');
      });
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count for messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hello, how can you help me today?' },
        { role: 'assistant' as const, content: 'I can help you with various tasks including answering questions, providing information, and assisting with problem-solving.' },
      ];

      const count = anthropicService.estimateTokenCount(messages);
      
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
        anthropicService.createChatCompletion(messages, {
          model: 'invalid-model-name',
        })
      ).rejects.toThrow();
    }, 10000);

    it('should handle very long prompts gracefully', async () => {
      // Create a prompt that exceeds typical limits
      const longContent = 'Test '.repeat(50000); // Very long content
      const messages = [
        { role: 'user' as const, content: longContent },
      ];

      await expect(
        anthropicService.createChatCompletion(messages, {
          maxTokens: 10,
        })
      ).rejects.toThrow();
    }, 10000);
  });

  describe('streaming', () => {
    it('should create a streaming response', async () => {
      const messages = [
        { role: 'user' as const, content: 'Count from 1 to 5' },
      ];

      const stream = await anthropicService.createStreamingChatCompletion(messages, {
        maxTokens: 50,
      });

      expect(stream).toBeDefined();
      expect(stream).toHaveProperty(Symbol.asyncIterator);

      // Collect streamed chunks
      const chunks: string[] = [];
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          chunks.push(chunk.delta.text);
        }
      }

      const fullResponse = chunks.join('');
      expect(fullResponse).toBeTruthy();
      expect(fullResponse).toMatch(/[1-5]/); // Should contain numbers 1-5
    }, 15000);
  });
});