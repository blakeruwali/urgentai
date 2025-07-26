import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

// Define environment schema
const envSchema = z.object({
  PORT: z.string().default('3001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  ANTHROPIC_API_KEY: z.string(),
  ANTHROPIC_MODEL: z.string().default('claude-3-opus-20240229'),
  ANTHROPIC_MAX_TOKENS: z.string().transform(Number).default('1000'),
  ANTHROPIC_TEMPERATURE: z.string().transform(Number).default('0.7'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string(),
  JWT_EXPIRY: z.string().default('7d'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Validate and export environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      console.error(error.flatten().fieldErrors);
      process.exit(1);
    }
    throw error;
  }
};

export const env = parseEnv();

// Type for environment variables
export type Env = z.infer<typeof envSchema>;