import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { userRepository } from '../../database/repositories/user.repository.js';
import { prisma } from '../../database/client.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import bcrypt from 'bcryptjs';

// Mock data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
};

describe('UserRepository', () => {
  // Clean up database before each test
  beforeEach(async () => {
    await prisma.usageRecord.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const user = await userRepository.create(testUser);

      expect(user).toBeDefined();
      expect(user.email).toBe(testUser.email);
      expect(user.name).toBe(testUser.name);
      expect(user.password).not.toBe(testUser.password); // Should be hashed
      expect(user.role).toBe('USER');
      expect(user.isActive).toBe(true);
    });

    it('should hash the password', async () => {
      const user = await userRepository.create(testUser);
      
      const isPasswordValid = await bcrypt.compare(testUser.password, user.password);
      expect(isPasswordValid).toBe(true);
    });

    it('should throw ValidationError if email already exists', async () => {
      await userRepository.create(testUser);

      await expect(userRepository.create(testUser))
        .rejects
        .toThrow(ValidationError);

      await expect(userRepository.create(testUser))
        .rejects
        .toThrow('User with this email already exists');
    });

    it('should create admin user', async () => {
      const adminData = {
        ...testUser,
        email: 'admin@example.com',
        role: 'ADMIN' as const,
      };

      const user = await userRepository.create(adminData);
      expect(user.role).toBe('ADMIN');
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const createdUser = await userRepository.create(testUser);
      const foundUser = await userRepository.findById(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(createdUser.email);
    });

    it('should return null if user not found', async () => {
      const user = await userRepository.findById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      await userRepository.create(testUser);
      const user = await userRepository.findByEmail(testUser.email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(testUser.email);
    });

    it('should return null if email not found', async () => {
      const user = await userRepository.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });
  });

  describe('findMany', () => {
    beforeEach(async () => {
      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await userRepository.create({
          email: `user${i}@example.com`,
          password: 'password123',
          name: `User ${i}`,
        });
      }
    });

    it('should return paginated users', async () => {
      const result = await userRepository.findMany({
        skip: 0,
        take: 3,
      });

      expect(result.users).toHaveLength(3);
      expect(result.total).toBe(5);
    });

    it('should filter users', async () => {
      const result = await userRepository.findMany({
        where: {
          email: { contains: 'user1' },
        },
      });

      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('user1@example.com');
    });

    it('should order users', async () => {
      const result = await userRepository.findMany({
        orderBy: { email: 'desc' },
        take: 2,
      });

      expect(result.users[0].email).toBe('user4@example.com');
      expect(result.users[1].email).toBe('user3@example.com');
    });
  });

  describe('update', () => {
    it('should update user', async () => {
      const user = await userRepository.create(testUser);
      
      const updated = await userRepository.update(user.id, {
        name: 'Updated Name',
        role: 'ADMIN',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.role).toBe('ADMIN');
      expect(updated.email).toBe(testUser.email); // Unchanged
    });

    it('should throw NotFoundError if user not found', async () => {
      await expect(userRepository.update('non-existent-id', { name: 'Test' }))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ValidationError if email already taken', async () => {
      const user1 = await userRepository.create(testUser);
      const user2 = await userRepository.create({
        ...testUser,
        email: 'other@example.com',
      });

      await expect(userRepository.update(user2.id, { email: user1.email }))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const user = await userRepository.create(testUser);
      const newPassword = 'newPassword123';

      await userRepository.updatePassword(user.id, newPassword);

      // Verify new password works
      const updatedUser = await userRepository.verifyPassword(user.email, newPassword);
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.id).toBe(user.id);

      // Verify old password doesn't work
      const oldPasswordCheck = await userRepository.verifyPassword(user.email, testUser.password);
      expect(oldPasswordCheck).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const user = await userRepository.create(testUser);
      
      await userRepository.delete(user.id);

      const found = await userRepository.findById(user.id);
      expect(found).toBeNull();
    });
  });

  describe('verifyPassword', () => {
    it('should return user if password is correct', async () => {
      const user = await userRepository.create(testUser);
      
      const verified = await userRepository.verifyPassword(testUser.email, testUser.password);
      
      expect(verified).toBeDefined();
      expect(verified?.id).toBe(user.id);
    });

    it('should return null if password is incorrect', async () => {
      await userRepository.create(testUser);
      
      const verified = await userRepository.verifyPassword(testUser.email, 'wrongpassword');
      
      expect(verified).toBeNull();
    });

    it('should return null if user is inactive', async () => {
      const user = await userRepository.create(testUser);
      await userRepository.update(user.id, { isActive: false });
      
      const verified = await userRepository.verifyPassword(testUser.email, testUser.password);
      
      expect(verified).toBeNull();
    });

    it('should return null if user not found', async () => {
      const verified = await userRepository.verifyPassword('nonexistent@example.com', 'password');
      
      expect(verified).toBeNull();
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const user = await userRepository.create(testUser);

      // Create test data
      const conversation = await prisma.conversation.create({
        data: {
          title: 'Test Conversation',
          userId: user.id,
        },
      });

      await prisma.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            userId: user.id,
            role: 'USER',
            content: 'Test message 1',
          },
          {
            conversationId: conversation.id,
            userId: user.id,
            role: 'ASSISTANT',
            content: 'Test response',
          },
        ],
      });

      await prisma.usageRecord.create({
        data: {
          userId: user.id,
          model: 'gpt-4',
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
          cost: 0.01,
          requestCount: 5,
        },
      });

      const stats = await userRepository.getUserStats(user.id);

      expect(stats).toEqual({
        conversationCount: 1,
        messageCount: 2,
        totalTokensUsed: 300,
        totalCost: 0.01,
      });
    });

    it('should return zero stats for new user', async () => {
      const user = await userRepository.create(testUser);
      const stats = await userRepository.getUserStats(user.id);

      expect(stats).toEqual({
        conversationCount: 0,
        messageCount: 0,
        totalTokensUsed: 0,
        totalCost: 0,
      });
    });
  });
});