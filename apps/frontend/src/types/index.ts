export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  framework: 'react' | 'vue' | 'angular' | 'vanilla';
  status: 'draft' | 'building' | 'completed' | 'deployed';
  userId: string;
  files: ProjectFile[];
  previewUrl?: string;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  type: 'component' | 'page' | 'style' | 'config' | 'asset';
  language: 'typescript' | 'javascript' | 'css' | 'html' | 'json' | 'markdown';
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  name: string;
  userId: string;
  projectId?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  type: 'text' | 'voice' | 'code' | 'error';
  conversationId: string;
  metadata?: {
    codeGenerated?: boolean;
    filesCreated?: string[];
    executionTime?: number;
    model?: string;
  };
  createdAt: string;
}

export interface ChatState {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
}

export interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  isLoading: boolean;
  error: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface GenerationRequest {
  prompt: string;
  projectId?: string;
  framework?: Project['framework'];
  context?: {
    existingFiles?: ProjectFile[];
    conversation?: Message[];
  };
}

export interface GenerationResponse {
  files: {
    name: string;
    path: string;
    content: string;
    type: ProjectFile['type'];
    language: ProjectFile['language'];
  }[];
  explanation: string;
  suggestedNextSteps?: string[];
}