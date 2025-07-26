import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';

// Extend PrismaClient with logging
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: env.NODE_ENV === 'development' 
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'event' },
          { level: 'warn', emit: 'event' },
        ]
      : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// Create singleton instance
export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Log queries in development
if (env.NODE_ENV === 'development') {
  // @ts-ignore
  prisma.$on('query', (e: any) => {
    logger.debug('Prisma Query', {
      query: e.query,
      params: e.params,
      duration: e.duration,
    });
  });

  // @ts-ignore
  prisma.$on('error', (e: any) => {
    logger.error('Prisma Error', e);
  });

  // @ts-ignore
  prisma.$on('warn', (e: any) => {
    logger.warn('Prisma Warning', e);
  });
}

// Database connection management
export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw new DatabaseError('Failed to connect to database');
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Failed to disconnect from database', { error });
    throw new DatabaseError('Failed to disconnect from database');
  }
}

// Health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}

// Transaction helper with error handling
export async function withTransaction<T>(
  fn: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  try {
    return await prisma.$transaction(async (tx) => {
      return await fn(tx as PrismaClient);
    });
  } catch (error) {
    logger.error('Transaction failed', { error });
    throw new DatabaseError('Transaction failed');
  }
}