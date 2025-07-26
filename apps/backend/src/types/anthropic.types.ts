export interface ClaudeRequest {
  messages: Message[];
  conversationId: string;
  context?: ConversationContext;
  options?: GenerationOptions;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  temperature?: number;
  processing_time?: number;
}

export interface ClaudeResponse {
  id: string;
  content: string;
  role: 'assistant';
  type: 'text' | 'code';
  metadata: {
    model: string;
    tokens_used: number;
    finish_reason: string;
    processing_time: number;
  };
  createdAt: string;
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

export enum AnthropicErrorType {
  API_KEY_INVALID = 'api_key_invalid',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  TOKEN_LIMIT_EXCEEDED = 'token_limit_exceeded',
  MODEL_UNAVAILABLE = 'model_unavailable',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  VALIDATION_ERROR = 'validation_error',
  INTERNAL_ERROR = 'internal_error'
}

export interface AnthropicError extends Error {
  type: AnthropicErrorType;
  code?: string;
  retryAfter?: number;
  suggestions?: string[];
  details?: any;
}

export interface ErrorResponse {
  error: AnthropicErrorType;
  message: string;
  retryAfter?: number;
  suggestions: string[];
}

export interface ModelConfig {
  model: string;
  max_tokens: number;
  temperature: number;
  system: string;
  timeout: number;
  maxRetries: number;
}

export interface StreamingResponse {
  id: string;
  chunk: string;
  done: boolean;
  metadata?: {
    tokens_generated?: number;
    finish_reason?: string;
  };
}

export interface ConversationSummary {
  id: string;
  title: string;
  summary: string;
  messageCount: number;
  lastActivity: string;
  topics: string[];
} 