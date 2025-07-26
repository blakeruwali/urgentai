import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, checkDatabaseHealth } from './database/client.js';
import { anthropicService } from './services/anthropic.service.js';
import { AppError } from './utils/errors.js';

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const anthropicHealth = await anthropicService.validateApiKey();
    
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? 'healthy' : 'unhealthy',
        anthropic: anthropicHealth ? 'healthy' : 'unhealthy',
      },
      environment: env.NODE_ENV,
    };

    const statusCode = dbHealth && anthropicHealth ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'UrgentAI Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      anthropic: '/api/anthropic',
      users: '/api/users',
      conversations: '/api/conversations',
      messages: '/api/messages',
    },
  });
});

// TODO: Add API routes here
// app.use('/api/anthropic', anthropicRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/conversations', conversationRoutes);
// app.use('/api/messages', messageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err,
    path: req.path,
    method: req.method,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code || 'APP_ERROR',
      message: err.message,
    });
  }

  // Default error response
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connection established');

    // Validate Anthropic API key
    const anthropicValid = await anthropicService.validateApiKey();
    if (!anthropicValid) {
      logger.warn('Anthropic API key validation failed - service may not work properly');
    }

    // Start listening
    const port = parseInt(env.PORT);
    app.listen(port, () => {
      logger.info(`Server running on port ${port}`, {
        environment: env.NODE_ENV,
        corsOrigin: env.CORS_ORIGIN,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();