import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
config({ path: path.resolve(__dirname, '../../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/urgentai_test?schema=public';

// Global test setup
beforeAll(async () => {
  console.log('🧪 Starting test suite...');
});

// Global test teardown
afterAll(async () => {
  console.log('✅ Test suite completed');
});