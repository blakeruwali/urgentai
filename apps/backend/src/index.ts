import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { chatController } from './controllers/chat.controller';

// Load environment variables
dotenv.config();

console.log('Environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- ANTHROPIC_API_KEY configured:', !!process.env.ANTHROPIC_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI App Platform Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY
  });
});

// API Routes

// Chat endpoints
app.post('/api/chat/send', chatController.sendMessage.bind(chatController));
app.post('/api/chat/stream', chatController.sendStreamingMessage.bind(chatController));
app.get('/api/conversations/:conversationId', chatController.getConversation.bind(chatController));
app.post('/api/conversations', chatController.createConversation.bind(chatController));

// Model configuration
app.get('/api/model/config', chatController.getModelConfig.bind(chatController));

// Mock endpoints for compatibility (these would be replaced with real implementations)
app.get('/api/conversations', (req, res) => {
  res.json({
    success: true,
    conversations: [],
    message: 'No conversations yet - start chatting to create one!'
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('🚨 Unhandled error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Startup validation
function validateEnvironment() {
  const required = ['ANTHROPIC_API_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  console.log('✅ Environment validation passed');
}

// Start server
async function startServer() {
  try {
    // Validate environment
    validateEnvironment();
    
    // Test Anthropic connection (this will happen when the service is first used)
    console.log('🔧 Anthropic service ready');
    
    app.listen(PORT, () => {
      console.log('🚀 Server started successfully!');
      console.log(`📡 API Server running on http://localhost:${PORT}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🤖 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Not configured'}`);
      console.log('');
      console.log('📋 Available endpoints:');
      console.log('   GET  /health                     - Health check');
      console.log('   POST /api/chat/send             - Send message to Claude');
      console.log('   POST /api/chat/stream           - Send streaming message to Claude');
      console.log('   GET  /api/conversations/:id     - Get conversation messages');
      console.log('   POST /api/conversations         - Create new conversation');
      console.log('   GET  /api/model/config          - Get Claude model configuration');
      console.log('');
      console.log('🎯 Ready to receive requests!');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📴 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer(); 