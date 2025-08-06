import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { chatController } from './controllers/chat.controller';
import { conversationService } from './services/conversation.service';
import { databaseProjectController } from './controllers/database-project.controller';
import { livePreviewController } from './controllers/live-preview.controller';
import { aiFixController } from './controllers/ai-fix.controller';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Environment check and logging
console.log('\nEnvironment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('- PORT:', process.env.PORT || 'undefined');
console.log('- ANTHROPIC_API_KEY configured:', !!process.env.ANTHROPIC_API_KEY);
console.log('- DATABASE_URL configured:', !!process.env.DATABASE_URL);

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('❌ Missing required environment variables:');
  console.log('   - ANTHROPIC_API_KEY');
  console.log('\nPlease check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'AI App Platform Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    anthropicConfigured: !!process.env.ANTHROPIC_API_KEY,
    databaseConnected: !!process.env.DATABASE_URL,
    storage: 'database',
    livePreview: 'enabled'
  });
});

// Chat endpoints
app.post('/api/chat/send', (req, res) => chatController.sendMessage(req, res));
app.post('/api/chat/stream', (req, res) => chatController.sendStreamingMessage(req, res));

// Conversation endpoints
app.post('/api/conversations', async (req, res) => {
  try {
    const { title, userId = 'default-user', model } = req.body;
    
    const conversation = await conversationService.createConversation({
      title: title || 'New Conversation',
      userId,
      model: model || 'claude-3-opus-20240229'
    });
    
    res.json({
      success: true,
      conversation
    });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      error: 'Failed to create conversation',
      message: error.message
    });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await conversationService.getConversationWithMessages(id);
    
    if (!result) {
      res.status(404).json({
        error: 'Conversation not found'
      });
      return;
    }
    
    res.json({
      success: true,
      conversation: result,
      messages: result.messages
    });
  } catch (error: any) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      error: 'Failed to get conversation',
      message: error.message
    });
  }
});

app.get('/api/users/:userId/conversations', async (req, res) => {
  try {
    const { userId } = req.params;
    const conversations = await conversationService.getUserConversations(userId);
    
    res.json({
      success: true,
      conversations
    });
  } catch (error: any) {
    console.error('Error getting user conversations:', error);
    res.status(500).json({
      error: 'Failed to get conversations',
      message: error.message
    });
  }
});

// 🚀 DATABASE-FIRST PROJECT MANAGEMENT ENDPOINTS
// Template endpoints
app.get('/api/templates', (req, res) => databaseProjectController.getTemplates(req, res));

// Project endpoints - NOW USING DATABASE STORAGE
app.post('/api/projects/create-from-description', (req, res) => 
  databaseProjectController.createProjectFromDescription(req, res));
app.post('/api/projects', (req, res) => databaseProjectController.createProject(req, res));
app.get('/api/projects', (req, res) => databaseProjectController.listUserProjects(req, res));
app.get('/api/projects/:projectId', (req, res) => databaseProjectController.getProject(req, res));

// File management endpoints - DATABASE STORAGE
app.put('/api/projects/:projectId/files', (req, res) => 
  databaseProjectController.updateFile(req, res));
app.post('/api/projects/:projectId/files', (req, res) => 
  databaseProjectController.addFile(req, res));

// Chat modification endpoint - ONGOING PROJECT CONVERSATIONS
app.post('/api/projects/:projectId/chat', (req, res) => 
  databaseProjectController.handleChatModification(req, res));

// Get project conversation history
app.get('/api/projects/:projectId/conversation', (req, res) => 
  databaseProjectController.getProjectConversation(req, res));

// Preview and export endpoints - DATABASE TO TEMP FILES
app.post('/api/projects/:projectId/preview', (req, res) => 
  databaseProjectController.generatePreview(req, res));
app.get('/api/projects/:projectId/export', (req, res) => 
  databaseProjectController.exportProject(req, res));

// 🔥 PHASE 3B: VM-BASED LIVE PREVIEW SYSTEM ENDPOINTS
// Live preview management
app.post('/api/projects/:projectId/preview/start', (req, res) => 
  livePreviewController.startPreview(req, res));
app.get('/api/projects/:projectId/preview', (req, res) => 
  livePreviewController.getPreview(req, res));
app.put('/api/projects/:projectId/preview', (req, res) => 
  livePreviewController.updatePreview(req, res));
app.delete('/api/projects/:projectId/preview', (req, res) => 
  livePreviewController.stopPreview(req, res));

// VM-specific endpoints for debugging and AI fixes
app.get('/api/projects/:projectId/preview/logs', (req, res) => 
  livePreviewController.getContainerLogs(req, res));
app.post('/api/projects/:projectId/preview/execute', (req, res) => 
  livePreviewController.executeInContainer(req, res));
app.get('/api/projects/:projectId/preview/info', (req, res) => 
  livePreviewController.getContainerInfo(req, res));

// Error detection endpoints
app.get('/api/projects/:projectId/preview/errors', (req, res) => 
  livePreviewController.detectErrors(req, res));
app.get('/api/projects/:projectId/preview/error-analysis', (req, res) => 
  livePreviewController.getErrorAnalysis(req, res));

// 🔧 AI FIX ENDPOINTS
app.post('/api/projects/:projectId/fix-error', (req, res) => 
  aiFixController.fixError(req, res));
app.post('/api/projects/:projectId/fix-all-errors', (req, res) => 
  aiFixController.fixAllErrors(req, res));

// Global preview management
app.get('/api/previews', (req, res) => livePreviewController.listPreviews(req, res));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 AI App Platform Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`🗂️ Projects API: http://localhost:${PORT}/api/projects`);
  console.log(`📋 Templates API: http://localhost:${PORT}/api/templates`);
  console.log(`🗄️ Storage: DATABASE-FIRST with on-demand file generation`);
  console.log(`🐳 VM Preview: http://localhost:${PORT}/api/projects/:id/preview/start`);
  console.log(`🔥 PHASE 3B: Docker VM Preview System ACTIVE!`);
});

export default app;


