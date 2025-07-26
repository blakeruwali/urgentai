import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { createServer } from 'http';
import { Server } from 'socket.io';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, checkDatabaseHealth } from './database/client.js';
import { anthropicService } from './services/anthropic.service.js';
import { AppError } from './utils/errors.js';

// Create Express app and HTTP server

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,

}));
app.use(express.json({ limit: '10mb' }));
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
      uptime: process.uptime(),
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
    status: 'active',
    endpoints: {
      health: '/health',
      anthropic: '/api/anthropic',
      chat: '/api/chat',
      users: '/api/users',
      conversations: '/api/conversations',
      messages: '/api/messages',
    },
  });
});

// Chat endpoint with Anthropic integration
app.post('/api/chat/message', async (req, res) => {
  try {
    const { content, conversationId, messages = [] } = req.body;
    
    // Add user message to the conversation
    messages.push({ role: 'user', content });
    
    // Get AI response from Anthropic
    const aiResponse = await anthropicService.createChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });
    
    const response = {
      id: Date.now().toString(),
      content: aiResponse.content,
      role: 'assistant',
      type: 'text',
      conversationId,
      metadata: {

        model: aiResponse.model,
        usage: aiResponse.usage,
        finishReason: aiResponse.finishReason,

      },
      createdAt: new Date().toISOString()
    };
    

    // Emit the response via Socket.IO for real-time updates
    io.to(conversationId).emit('message', response);
    
    res.json(response);
  } catch (error) {
    logger.error('Chat error:', error);

    res.status(500).json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Streaming chat endpoint
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { content, conversationId, messages = [] } = req.body;
    
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    messages.push({ role: 'user', content });
    
    const stream = await anthropicService.createStreamingChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });
    
    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    });
    
    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });
    
    stream.on('error', (error) => {
      logger.error('Stream error', { error });
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    });
  } catch (error) {
    logger.error('Streaming chat error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
    res.end();
  }
});

// Conversations endpoints
app.get('/api/conversations', async (req, res) => {
  try {
    // TODO: Implement with database
    res.json([]);
  } catch (error) {
    logger.error('Failed to fetch conversations', { error });
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { name, projectId } = req.body;
    
    // TODO: Implement with database
    const conversation = {
      id: Date.now().toString(),
      name: name || 'New Conversation',
      userId: 'mock-user-id', // TODO: Get from auth
      projectId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    res.json(conversation);
  } catch (error) {
    logger.error('Failed to create conversation', { error });
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// TODO: Add API routes here
// app.use('/api/anthropic', anthropicRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/messages', messageRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });
  
  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
    logger.info('Client joined conversation', { 
      socketId: socket.id, 
      conversationId 
    });
  });
  
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(conversationId);
    logger.info('Client left conversation', { 
      socketId: socket.id, 
      conversationId 
    });
  });
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

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
    server.listen(port, () => {
      logger.info(`🚀 Server running on port ${port}`, {
        environment: env.NODE_ENV,
        corsOrigin: env.CORS_ORIGIN,
      });
      logger.info(`📱 API: http://localhost:${port}/api`);
      logger.info(`🔍 Health: http://localhost:${port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

