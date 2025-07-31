import { Request, Response } from 'express';
import { anthropicService } from '../services/anthropic.service';
import { conversationService } from '../services/conversation.service';
import { ClaudeRequest, Message } from '../types/anthropic.types';
import { MessageRole } from '../generated/prisma';

export class ChatController {
  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, conversationId, context, options, userId = 'default-user' } = req.body;

      // Validate request
      if (!message || !message.trim()) {
        res.status(400).json({
          error: 'Message content is required'
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          error: 'Conversation ID is required'
        });
        return;
      }

      // Save user message to database
      const userMessage = await conversationService.addMessage({
        conversationId,
        role: MessageRole.USER,
        content: message.trim(),
        model: options?.model || 'claude-3-sonnet'
      });

      // Get conversation history from database
      const conversationData = await conversationService.getConversationWithMessages(conversationId);
      const conversationHistory: Message[] = conversationData?.messages.map(msg => ({
        id: msg.id,
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.createdAt.toISOString()
      })) || [];

      // Prepare request for Claude
      const claudeRequest: ClaudeRequest = {
        messages: conversationHistory,
        conversationId,
        context,
        options
      };

      // Send to Claude
      const startTime = Date.now();
      const claudeResponse = await anthropicService.sendMessage(claudeRequest);
      const executionTime = (Date.now() - startTime) / 1000;

      // Save Claude's response to database
      await conversationService.addMessage({
        conversationId,
        role: MessageRole.ASSISTANT,
        content: claudeResponse.content,
        tokens: claudeResponse.metadata?.tokens_used,
        model: claudeResponse.metadata?.model || options?.model || 'claude-3-sonnet',
        executionTime,
        metadata: claudeResponse.metadata
      });

      // Return response
      res.json({
        success: true,
        message: {
          id: claudeResponse.id,
          role: 'assistant',
          content: claudeResponse.content,
          type: claudeResponse.type,
          metadata: claudeResponse.metadata,
          createdAt: claudeResponse.createdAt
        },
        conversationId
      });

    } catch (error: any) {
      console.error('Error in sendMessage:', error);
      
      // Handle Anthropic-specific errors
      if (error.type) {
        res.status(this.getStatusCodeForErrorType(error.type)).json({
          error: error.message,
          type: error.type,
          retryAfter: error.retryAfter,
          suggestions: error.suggestions || []
        });
        return;
      }

      // Generic error response
      res.status(500).json({
        error: 'Failed to process message',
        message: error.message
      });
    }
  }

  /**
   * Send a streaming message to Claude
   */
  async sendStreamingMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, conversationId, context, options, userId = 'default-user' } = req.body;

      // Validate request
      if (!message || !message.trim()) {
        res.status(400).json({
          error: 'Message content is required'
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          error: 'Conversation ID is required'
        });
        return;
      }

      // Set up SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Save user message to database
      const userMessage = await conversationService.addMessage({
        conversationId,
        role: MessageRole.USER,
        content: message.trim(),
        model: options?.model || 'claude-3-sonnet'
      });

      // Get conversation history from database
      const conversationData = await conversationService.getConversationWithMessages(conversationId);
      const conversationHistory: Message[] = conversationData?.messages.map(msg => ({
        id: msg.id,
        role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.createdAt.toISOString()
      })) || [];

      // Prepare request for Claude
      const claudeRequest: ClaudeRequest = {
        messages: conversationHistory,
        conversationId,
        context,
        options: { ...options, stream: true }
      };

      // Send streaming message to Claude
      const startTime = Date.now();
      const claudeResponse = await anthropicService.sendStreamingMessage(
        claudeRequest,
        (chunk) => {
          // Send chunk to client via SSE
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            id: chunk.id,
            content: chunk.chunk,
            done: chunk.done,
            metadata: chunk.metadata
          })}\n\n`);
        }
      );
      const executionTime = (Date.now() - startTime) / 1000;

      // Save Claude's response to database
      await conversationService.addMessage({
        conversationId,
        role: MessageRole.ASSISTANT,
        content: claudeResponse.content,
        tokens: claudeResponse.metadata?.tokens_used,
        model: claudeResponse.metadata?.model || options?.model || 'claude-3-sonnet',
        executionTime,
        metadata: claudeResponse.metadata
      });

      // Send final message
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        message: {
          id: claudeResponse.id,
          role: 'assistant',
          content: claudeResponse.content,
          type: claudeResponse.type,
          metadata: claudeResponse.metadata,
          createdAt: claudeResponse.createdAt
        }
      })}\n\n`);

      res.end();

    } catch (error: any) {
      console.error('Error in sendStreamingMessage:', error);
      
      // Send error via SSE
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message,
        errorType: error.type
      })}\n\n`);
      
      res.end();
    }
  }

  /**
   * Get conversation messages from database
   */
  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        res.status(400).json({
          error: 'Conversation ID is required'
        });
        return;
      }

      // Get conversation from database
      const conversationData = await conversationService.getConversationWithMessages(conversationId);

      if (!conversationData) {
        res.status(404).json({
          error: 'Conversation not found'
        });
        return;
      }

      // Format messages for response
      const messages = conversationData.messages.map(msg => ({
        id: msg.id,
        role: msg.role.toLowerCase(),
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        metadata: msg.metadata
      }));

      res.json({
        success: true,
        conversation: {
          id: conversationData.id,
          title: conversationData.title,
          model: conversationData.model,
          createdAt: conversationData.createdAt.toISOString(),
          updatedAt: conversationData.updatedAt.toISOString()
        },
        messages,
        messageCount: messages.length
      });

    } catch (error: any) {
      console.error('Error in getConversation:', error);
      res.status(500).json({
        error: 'Failed to get conversation',
        message: error.message
      });
    }
  }

  /**
   * Create a new conversation in database
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const { title, userId = 'default-user', model, temperature, maxTokens, systemPrompt } = req.body;

      // Create conversation in database
      const conversation = await conversationService.createConversation({
        title: title || 'New Conversation',
        userId,
        model: model || 'claude-3-sonnet',
        temperature,
        maxTokens,
        systemPrompt
      });

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          model: conversation.model,
          userId: conversation.userId,
          createdAt: conversation.createdAt.toISOString(),
          messageCount: 0
        }
      });

    } catch (error: any) {
      console.error('Error in createConversation:', error);
      res.status(500).json({
        error: 'Failed to create conversation',
        message: error.message
      });
    }
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(req: Request, res: Response): Promise<void> {
    try {
      const { userId = 'default-user' } = req.params;
      const { limit } = req.query;

      const conversations = await conversationService.getUserConversations(
        userId,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        success: true,
        conversations: conversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          model: conv.model,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString(),
          messageCount: (conv as any)._count?.messages || 0
        }))
      });

    } catch (error: any) {
      console.error('Error in getUserConversations:', error);
      res.status(500).json({
        error: 'Failed to get conversations',
        message: error.message
      });
    }
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const { title } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({
          error: 'Title is required'
        });
        return;
      }

      const conversation = await conversationService.updateConversationTitle(
        conversationId,
        title.trim()
      );

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt.toISOString()
        }
      });

    } catch (error: any) {
      console.error('Error in updateConversationTitle:', error);
      res.status(500).json({
        error: 'Failed to update conversation title',
        message: error.message
      });
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;

      await conversationService.deleteConversation(conversationId);

      res.json({
        success: true,
        message: 'Conversation deleted successfully'
      });

    } catch (error: any) {
      console.error('Error in deleteConversation:', error);
      res.status(500).json({
        error: 'Failed to delete conversation',
        message: error.message
      });
    }
  }

  /**
   * Get model configuration
   */
  async getModelConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = anthropicService.getModelConfig();
      res.json({
        success: true,
        config
      });
    } catch (error: any) {
      console.error('Error in getModelConfig:', error);
      res.status(500).json({
        error: 'Failed to get model configuration',
        message: error.message
      });
    }
  }

  // Private helper methods

  private getStatusCodeForErrorType(errorType: string): number {
    switch (errorType) {
      case 'api_key_invalid':
        return 401;
      case 'rate_limit_exceeded':
        return 429;
      case 'token_limit_exceeded':
        return 413;
      case 'validation_error':
        return 400;
      case 'model_unavailable':
        return 503;
      case 'timeout':
        return 408;
      case 'network_error':
        return 502;
      default:
        return 500;
    }
  }
}

// Export controller instance
export const chatController = new ChatController(); 