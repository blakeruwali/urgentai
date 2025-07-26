// User and Authentication
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
}

// Projects and Files
export interface Project {
  id: string;
  name: string;
  description?: string;
  framework: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ProjectFile {
  path: string;
  content: string;
  type: string;
  size: number;
  updatedAt: string;
}

// Conversations and Messages
export interface Conversation {
  id: string;
  title: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'code';
  timestamp: string;
  conversationId: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokens_used?: number;
  finish_reason?: string;
  processing_time?: number;
}

// API Request/Response Types
export interface SendMessageRequest {
  message: string;
  conversationId: string;
  context?: ConversationContext;
  options?: GenerationOptions;
}

export interface SendMessageResponse {
  success: boolean;
  message: Message;
  conversationId: string;
}

export interface ConversationContext {
  projectId?: string;
  framework?: string;
  previousMessages?: Message[];
  userPreferences?: UserPreferences;
}

export interface UserPreferences {
  codeStyle?: 'functional' | 'class-based';
  framework?: 'react' | 'vue' | 'angular';
  styling?: 'tailwind' | 'css' | 'styled-components';
  typescript?: boolean;
}

export interface GenerationOptions {
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  model?: string;
}

// API Error Types
export interface ApiError {
  error: string;
  message: string;
  type?: string;
  retryAfter?: number;
  suggestions?: string[];
}

// Streaming Types
export interface StreamingChunk {
  type: 'chunk' | 'complete' | 'error';
  id?: string;
  content?: string;
  done?: boolean;
  message?: Message;
  error?: string;
  errorType?: string;
  metadata?: {
    tokens_generated?: number;
    finish_reason?: string;
  };
}

// State Management Types
export interface ChatState {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  streamingMessageId: string | null;
}

export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  files: Record<string, ProjectFile[]>; // projectId -> files
  isLoading: boolean;
  error: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Generation and Code Types
export interface GenerationRequest {
  prompt: string;
  type: 'component' | 'page' | 'api' | 'general';
  framework?: string;
  context?: string;
  projectId?: string;
}

export interface GenerationResponse {
  id: string;
  code: string;
  filename?: string;
  explanation: string;
  dependencies?: string[];
  type: 'text' | 'code';
}

// Model Configuration
export interface ModelConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  timeout: number;
  maxRetries: number;
}

// Health Check
export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  environment: string;
  anthropicConfigured: boolean;
} 