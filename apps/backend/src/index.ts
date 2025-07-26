import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'AI App Platform API',
    version: '1.0.0',
    status: 'active'
  });
});

// Mock chat endpoint for development
app.post('/api/chat/message', async (req, res) => {
  try {
    const { content, conversationId } = req.body;
    
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock AI response
    const aiResponse = {
      id: Date.now().toString(),
      content: `I understand you want to: "${content}". This is a mock response. Once the AI service is integrated, I'll be able to help you generate code and build applications based on your requests.`,
      role: 'assistant',
      type: 'text',
      conversationId,
      metadata: {
        model: 'mock-ai',
        executionTime: Math.floor(Math.random() * 3000) + 500
      },
      createdAt: new Date().toISOString()
    };
    
    res.json(aiResponse);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mock conversations endpoint
app.get('/api/conversations', (req, res) => {
  res.json([]);
});

app.post('/api/conversations', (req, res) => {
  const { name, projectId } = req.body;
  
  const conversation = {
    id: Date.now().toString(),
    name: name || 'New Conversation',
    userId: 'mock-user-id',
    projectId,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  res.json(conversation);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`Client ${socket.id} joined conversation ${conversationId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 API: http://localhost:${PORT}/api`);
  console.log(`🔍 Health: http://localhost:${PORT}/health`);
});