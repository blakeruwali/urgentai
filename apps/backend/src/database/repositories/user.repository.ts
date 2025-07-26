import { prisma } from '../client.js';
import { User, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: 'USER' | 'ADMIN' | 'MODERATOR';
  isActive?: boolean;
}

export class UserRepository {
  /**
   * Create a new user
   */
  async create(data: CreateUserInput): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        throw new ValidationError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
        },
      });

      logger.info('User created', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Failed to create user', { error, data });
      throw new DatabaseError('Failed to create user');
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find user by ID', { error, id });
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      return await prisma.user.findUnique({
        where: { email },
      });
    } catch (error) {
      logger.error('Failed to find user by email', { error, email });
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Get all users with pagination
   */
  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<{ users: User[]; total: number }> {
    try {
      const [users, total] = await prisma.$transaction([
        prisma.user.findMany(params),
        prisma.user.count({ where: params.where }),
      ]);

      return { users, total };
    } catch (error) {
      logger.error('Failed to find users', { error, params });
      throw new DatabaseError('Failed to find users');
    }
  }

  /**
   * Update user
   */
  async update(id: string, data: UpdateUserInput): Promise<User> {
    try {
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        throw new NotFoundError('User not found');
      }

      // Check email uniqueness if updating email
      if (data.email && data.email !== existingUser.email) {
        const emailTaken = await this.findByEmail(data.email);
        if (emailTaken) {
          throw new ValidationError('Email is already taken');
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data,
      });

      logger.info('User updated', { userId: user.id });
      return user;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      logger.error('Failed to update user', { error, id, data });
      throw new DatabaseError('Failed to update user');
    }
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      logger.info('User password updated', { userId: id });
    } catch (error) {
      logger.error('Failed to update user password', { error, id });
      throw new DatabaseError('Failed to update password');
    }
  }

  /**
   * Delete user
   */
  async delete(id: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { id },
      });

      logger.info('User deleted', { userId: id });
    } catch (error) {
      logger.error('Failed to delete user', { error, id });
      throw new DatabaseError('Failed to delete user');
    }
  }

  /**
   * Verify user password
   */
  async verifyPassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findByEmail(email);
      if (!user || !user.isActive) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Failed to verify password', { error, email });
      throw new DatabaseError('Failed to verify password');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    conversationCount: number;
    messageCount: number;
    totalTokensUsed: number;
    totalCost: number;
  }> {
    try {
      const [conversationCount, messageCount, usageStats] = await prisma.$transaction([
        prisma.conversation.count({ where: { userId } }),
        prisma.message.count({ where: { userId } }),
        prisma.usageRecord.aggregate({
          where: { userId },
          _sum: {
            totalTokens: true,
            cost: true,
          },
        }),
      ]);

      return {
        conversationCount,
        messageCount,
        totalTokensUsed: usageStats._sum.totalTokens || 0,
        totalCost: usageStats._sum.cost || 0,
      };
    } catch (error) {
      logger.error('Failed to get user stats', { error, userId });
      throw new DatabaseError('Failed to get user statistics');
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();