import { prisma } from './client.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';

async function seed() {
  logger.info('Starting database seeding...');

  try {
    // Clear existing data
    await prisma.attachment.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.usageRecord.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.user.deleteMany();
    await prisma.systemSetting.deleteMany();

    logger.info('Cleared existing data');

    // Create tags
    const tags = await Promise.all([
      prisma.tag.create({
        data: {
          name: 'work',
          color: '#3B82F6',
        },
      }),
      prisma.tag.create({
        data: {
          name: 'personal',
          color: '#10B981',
        },
      }),
      prisma.tag.create({
        data: {
          name: 'research',
          color: '#8B5CF6',
        },
      }),
      prisma.tag.create({
        data: {
          name: 'learning',
          color: '#F59E0B',
        },
      }),
    ]);

    logger.info('Created tags', { count: tags.length });

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    const regularUser = await prisma.user.create({
      data: {
        email: 'user@example.com',
        name: 'Regular User',
        password: hashedPassword,
        role: 'USER',
      },
    });

    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        password: hashedPassword,
        role: 'USER',
      },
    });

    logger.info('Created users', { count: 3 });

    // Create conversations
    const conversation1 = await prisma.conversation.create({
      data: {
        title: 'Getting Started with AI',
        userId: regularUser.id,
        tags: {
          connect: [{ id: tags[3].id }], // learning
        },
        messages: {
          create: [
            {
              userId: regularUser.id,
              role: 'USER',
              content: 'What are the basics of machine learning?',
              createdAt: new Date('2024-01-15T10:00:00Z'),
            },
            {
              userId: regularUser.id,
              role: 'ASSISTANT',
              content: 'Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed. Here are the basics:\n\n1. **Types of Machine Learning**:\n   - Supervised Learning\n   - Unsupervised Learning\n   - Reinforcement Learning\n\n2. **Key Components**:\n   - Data\n   - Features\n   - Models\n   - Training\n   - Evaluation',
              model: 'claude-3-opus-20240229',
              promptTokens: 15,
              completionTokens: 120,
              totalTokens: 135,
              createdAt: new Date('2024-01-15T10:00:30Z'),
            },
          ],
        },
      },
    });

    const conversation2 = await prisma.conversation.create({
      data: {
        title: 'Project Planning Discussion',
        userId: regularUser.id,
        model: 'claude-3-sonnet-20240229',
        temperature: 0.5,
        tags: {
          connect: [{ id: tags[0].id }], // work
        },
        messages: {
          create: [
            {
              userId: regularUser.id,
              role: 'SYSTEM',
              content: 'You are a helpful project management assistant.',
              createdAt: new Date('2024-01-16T14:00:00Z'),
            },
            {
              userId: regularUser.id,
              role: 'USER',
              content: 'Help me create a project timeline for a new mobile app.',
              createdAt: new Date('2024-01-16T14:00:10Z'),
            },
            {
              userId: regularUser.id,
              role: 'ASSISTANT',
              content: 'I\'d be happy to help you create a project timeline for your mobile app. Here\'s a suggested timeline:\n\n**Phase 1: Planning (2 weeks)**\n- Requirements gathering\n- Market research\n- Technical feasibility\n\n**Phase 2: Design (3 weeks)**\n- UI/UX design\n- Wireframes\n- Prototypes\n\n**Phase 3: Development (8-10 weeks)**\n- Backend development\n- Frontend development\n- API integration\n\n**Phase 4: Testing (2 weeks)**\n- Unit testing\n- Integration testing\n- User acceptance testing\n\n**Phase 5: Deployment (1 week)**\n- App store submission\n- Production deployment',
              model: 'claude-3-sonnet-20240229',
              promptTokens: 25,
              completionTokens: 180,
              totalTokens: 205,
              createdAt: new Date('2024-01-16T14:00:40Z'),
            },
          ],
        },
      },
    });

    const conversation3 = await prisma.conversation.create({
      data: {
        title: 'Code Review Assistant',
        userId: adminUser.id,
        temperature: 0.3,
        maxTokens: 2000,
        tags: {
          connect: [
            { id: tags[0].id }, // work
            { id: tags[2].id }, // research
          ],
        },
        messages: {
          create: [
            {
              userId: adminUser.id,
              role: 'USER',
              content: 'Review this Python function:\n\n```python\ndef calculate_average(numbers):\n    total = 0\n    for n in numbers:\n        total = total + n\n    return total / len(numbers)\n```',
              createdAt: new Date('2024-01-17T09:00:00Z'),
            },
            {
              userId: adminUser.id,
              role: 'ASSISTANT',
              content: 'Here\'s my review of the function:\n\n**Issues:**\n1. No handling for empty lists (will raise ZeroDivisionError)\n2. No type hints\n3. Could be more Pythonic\n\n**Improved version:**\n```python\ndef calculate_average(numbers: list[float]) -> float:\n    """Calculate the average of a list of numbers.\n    \n    Args:\n        numbers: List of numbers to average\n        \n    Returns:\n        The arithmetic mean of the numbers\n        \n    Raises:\n        ValueError: If the list is empty\n    """\n    if not numbers:\n        raise ValueError("Cannot calculate average of empty list")\n    \n    return sum(numbers) / len(numbers)\n```\n\n**Improvements made:**\n- Added type hints\n- Added docstring\n- Used built-in `sum()` function\n- Added error handling for empty lists',
              model: 'claude-3-opus-20240229',
              promptTokens: 80,
              completionTokens: 220,
              totalTokens: 300,
              createdAt: new Date('2024-01-17T09:00:30Z'),
            },
          ],
        },
      },
    });

    logger.info('Created conversations', { count: 3 });

    // Create API keys
    const apiKey1 = await prisma.apiKey.create({
      data: {
        userId: regularUser.id,
        name: 'Production API Key',
        key: 'sk-prod-' + Math.random().toString(36).substring(2, 15),
        permissions: ['read', 'write'],
        lastUsedAt: new Date('2024-01-18T10:00:00Z'),
      },
    });

    const apiKey2 = await prisma.apiKey.create({
      data: {
        userId: adminUser.id,
        name: 'Admin API Key',
        key: 'sk-admin-' + Math.random().toString(36).substring(2, 15),
        permissions: ['read', 'write', 'delete', 'admin'],
        lastUsedAt: new Date('2024-01-19T15:00:00Z'),
      },
    });

    logger.info('Created API keys', { count: 2 });

    // Create usage records
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await Promise.all([
      prisma.usageRecord.create({
        data: {
          userId: regularUser.id,
          date: yesterday,
          model: 'claude-3-opus-20240229',
          promptTokens: 1500,
          completionTokens: 3200,
          totalTokens: 4700,
          cost: 0.047,
          requestCount: 15,
        },
      }),
      prisma.usageRecord.create({
        data: {
          userId: regularUser.id,
          date: today,
          model: 'claude-3-sonnet-20240229',
          promptTokens: 800,
          completionTokens: 1600,
          totalTokens: 2400,
          cost: 0.024,
          requestCount: 8,
        },
      }),
      prisma.usageRecord.create({
        data: {
          userId: adminUser.id,
          date: today,
          model: 'claude-3-opus-20240229',
          promptTokens: 2000,
          completionTokens: 4000,
          totalTokens: 6000,
          cost: 0.18,
          requestCount: 20,
        },
      }),
    ]);

    logger.info('Created usage records');

    // Create system settings
    await Promise.all([
      prisma.systemSetting.create({
        data: {
          key: 'maintenance_mode',
          value: { enabled: false, message: '' },
        },
      }),
      prisma.systemSetting.create({
        data: {
          key: 'rate_limits',
          value: {
            default: { requests: 100, window: '1h' },
            premium: { requests: 1000, window: '1h' },
          },
        },
      }),
      prisma.systemSetting.create({
        data: {
          key: 'available_models',
          value: {
            models: [
              { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', maxTokens: 200000 },
              { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', maxTokens: 200000 },
              { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', maxTokens: 200000 },
            ],
          },
        },
      }),
    ]);

    logger.info('Created system settings');

    logger.info('Database seeding completed successfully!');
    
    // Summary
    const summary = {
      users: await prisma.user.count(),
      conversations: await prisma.conversation.count(),
      messages: await prisma.message.count(),
      tags: await prisma.tag.count(),
      apiKeys: await prisma.apiKey.count(),
      usageRecords: await prisma.usageRecord.count(),
      systemSettings: await prisma.systemSetting.count(),
    };
    
    logger.info('Seed data summary:', summary);

  } catch (error) {
    logger.error('Seeding failed', { error });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seed()
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });