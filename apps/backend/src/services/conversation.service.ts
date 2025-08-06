import { prisma } from './database.service';
import { Conversation, Message, MessageRole, Prisma } from '../generated/prisma';

export interface CreateConversationInput {
  title: string;
  userId: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  metadata?: any;
}

export interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  tokens?: number;
  model?: string;
  executionTime?: number;
  metadata?: any;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

class ConversationService {
  // Create a new conversation
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    try {
      return await prisma.conversation.create({
        data: {
          title: input.title,
          userId: input.userId,
          model: input.model || 'claude-3-sonnet',
          temperature: input.temperature || 0.7,
          maxTokens: input.maxTokens || 4096,
          systemPrompt: input.systemPrompt,
          metadata: input.metadata || {},
        },
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  // Get conversation with messages
  async getConversationWithMessages(id: string): Promise<ConversationWithMessages | null> {
    try {
      return await prisma.conversation.findUnique({
        where: { id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw new Error('Failed to fetch conversation');
    }
  }

  // Get conversation by project ID
  async getConversationByProject(projectId: string): Promise<Conversation | null> {
    try {
      // For SQLite, we need to use a different approach since it doesn't support JSON path queries
      const conversations = await prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' }
      });
      
      // Filter conversations that have the projectId in metadata
      const conversation = conversations.find(conv => {
        try {
          const metadata = conv.metadata as any;
          return metadata && metadata.projectId === projectId;
        } catch {
          return false;
        }
      });
      
      return conversation || null;
    } catch (error) {
      console.error('Error fetching conversation by project:', error);
      throw new Error('Failed to fetch conversation by project');
    }
  }

  // Get all conversations for a user
  async getUserConversations(userId: string, limit = 50): Promise<Conversation[]> {
    try {
      return await prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: {
          _count: {
            select: { messages: true },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      throw new Error('Failed to fetch conversations');
    }
  }

  // Add message to conversation
  async addMessage(input: CreateMessageInput): Promise<Message> {
    try {
      // Update conversation's updatedAt timestamp
      await prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return await prisma.message.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          tokens: input.tokens,
          model: input.model,
          executionTime: input.executionTime,
          metadata: input.metadata || {},
        },
      });
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error('Failed to add message');
    }
  }

  // Update conversation title
  async updateConversationTitle(id: string, title: string): Promise<Conversation> {
    try {
      return await prisma.conversation.update({
        where: { id },
        data: { title },
      });
    } catch (error) {
      console.error('Error updating conversation title:', error);
      throw new Error('Failed to update conversation title');
    }
  }

  // Delete conversation
  async deleteConversation(id: string): Promise<void> {
    try {
      await prisma.conversation.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw new Error('Failed to delete conversation');
    }
  }

  // Search conversations by content
  async searchConversations(userId: string, query: string): Promise<ConversationWithMessages[]> {
    try {
      return await prisma.conversation.findMany({
        where: {
          userId,
          OR: [
            { title: { contains: query } },
            {
              messages: {
                some: {
                  content: { contains: query },
                },
              },
            },
          ],
        },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error) {
      console.error('Error searching conversations:', error);
      throw new Error('Failed to search conversations');
    }
  }

  // Get conversation statistics
  async getConversationStats(userId: string) {
    try {
      const totalConversations = await prisma.conversation.count({
        where: { userId },
      });

      const totalMessages = await prisma.message.count({
        where: {
          conversation: { userId },
        },
      });

      const totalTokens = await prisma.message.aggregate({
        where: {
          conversation: { userId },
          tokens: { not: null },
        },
        _sum: { tokens: true },
      });

      return {
        totalConversations,
        totalMessages,
        totalTokens: totalTokens._sum.tokens || 0,
      };
    } catch (error) {
      console.error('Error fetching conversation stats:', error);
      throw new Error('Failed to fetch conversation statistics');
    }
  }
}

export const conversationService = new ConversationService(); 