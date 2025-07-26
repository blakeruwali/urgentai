import { Request, Response } from 'express';
import { anthropicService } from '../services/anthropic.service';
import { ClaudeRequest, Message } from '../types/anthropic.types';

export class ChatController {
  /**
   * Send a message to Claude and get a response
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, conversationId, context, options } = req.body;

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

      // Create user message
      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      };

      // Get conversation history (in a real app, this would come from database)
      const conversationHistory = await this.getConversationHistory(conversationId);

      // Prepare request for Claude
      const claudeRequest: ClaudeRequest = {
        messages: [...conversationHistory, userMessage],
        conversationId,
        context,
        options
      };

      // Send to Claude
      const claudeResponse = await anthropicService.sendMessage(claudeRequest);

      // Save messages to database (mock implementation)
      await this.saveMessage(conversationId, userMessage);
      await this.saveMessage(conversationId, {
        id: claudeResponse.id,
        role: 'assistant',
        content: claudeResponse.content,
        timestamp: claudeResponse.createdAt,
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
      const { message, conversationId, context, options } = req.body;

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

      // Create user message
      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString()
      };

      // Get conversation history
      const conversationHistory = await this.getConversationHistory(conversationId);

      // Prepare request for Claude
      const claudeRequest: ClaudeRequest = {
        messages: [...conversationHistory, userMessage],
        conversationId,
        context,
        options: { ...options, stream: true }
      };

      // Send streaming message to Claude
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

      // Save messages to database
      await this.saveMessage(conversationId, userMessage);
      await this.saveMessage(conversationId, {
        id: claudeResponse.id,
        role: 'assistant',
        content: claudeResponse.content,
        timestamp: claudeResponse.createdAt,
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
   * Get conversation messages
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

      // Get conversation history
      const messages = await this.getConversationHistory(conversationId);

      res.json({
        success: true,
        conversationId,
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
   * Create a new conversation
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const { title, projectId } = req.body;

      const conversationId = this.generateConversationId();

      // In a real app, save to database
      console.log(`📝 Creating conversation: ${conversationId} - ${title}`);

      res.json({
        success: true,
        conversation: {
          id: conversationId,
          title: title || 'New Conversation',
          projectId,
          createdAt: new Date().toISOString(),
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

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConversationId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getConversationHistory(conversationId: string): Promise<Message[]> {
    // Mock implementation - in a real app, this would query the database
    // For now, return empty array (fresh conversation)
    console.log(`📚 Getting conversation history for: ${conversationId}`);
    return [];
  }

  private async saveMessage(conversationId: string, message: Message): Promise<void> {
    // Mock implementation - in a real app, this would save to database
    console.log(`💾 Saving message to conversation ${conversationId}:`, {
      id: message.id,
      role: message.role,
      content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
      timestamp: message.timestamp
    });
  }

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