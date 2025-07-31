import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  SendMessageRequest,
  SendMessageResponse,
  Conversation,
  Message,
  ApiError,
  HealthResponse,
  ModelConfig,
  StreamingChunk
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use environment variable or fallback to localhost
    this.baseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('❌ API Response Error:', error);
        return Promise.reject(this.formatError(error));
      }
    );
  }

  /**
   * Format API errors into a consistent structure
   */
  private formatError(error: AxiosError): ApiError {
    if (error.response) {
      // Server responded with error status
      const data = error.response.data as any;
      return {
        error: data.error || 'API Error',
        message: data.message || error.message,
        type: data.type,
        retryAfter: data.retryAfter,
        suggestions: data.suggestions || []
      };
    } else if (error.request) {
      // Request was made but no response received
      return {
        error: 'Network Error',
        message: 'Unable to connect to the server. Please check your connection.',
        suggestions: ['Check your internet connection', 'Try again in a moment']
      };
    } else {
      // Something else happened
      return {
        error: 'Unknown Error',
        message: error.message || 'An unexpected error occurred',
        suggestions: ['Try refreshing the page', 'Contact support if the issue persists']
      };
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/health');
    return response.data;
  }

  /**
   * Send a message to Claude
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await this.client.post<SendMessageResponse>('/api/chat/send', request);
    return response.data;
  }

  /**
   * Send a streaming message to Claude
   */
  async sendStreamingMessage(
    request: SendMessageRequest,
    onChunk: (chunk: StreamingChunk) => void,
    onComplete: (message: Message) => void,
    onError: (error: ApiError) => void
  ): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as StreamingChunk;
                
                if (data.type === 'chunk') {
                  onChunk(data);
                } else if (data.type === 'complete' && data.message) {
                  onComplete(data.message);
                } else if (data.type === 'error') {
                  onError({
                    error: data.errorType || 'Streaming Error',
                    message: data.error || 'An error occurred during streaming',
                    suggestions: ['Try sending the message again', 'Check your connection']
                  });
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Streaming error:', error);
      onError(this.formatError(error as AxiosError));
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(title: string, userId: string = 'default-user', model?: string): Promise<Conversation> {
    const response = await this.client.post<{ success: boolean; conversation: Conversation }>('/api/conversations', {
      title,
      userId,
      model
    });
    return response.data.conversation;
  }

  /**
   * Get conversation with messages
   */
  async getConversation(conversationId: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const response = await this.client.get<{ 
      success: boolean; 
      conversation: Conversation;
      messages: Message[]; 
    }>(`/api/conversations/${conversationId}`);
    return {
      conversation: response.data.conversation,
      messages: response.data.messages
    };
  }

  /**
   * Get all conversations for a user
   */
  async getUserConversations(userId: string = 'default-user'): Promise<Conversation[]> {
    const response = await this.client.get<{ 
      success: boolean; 
      conversations: Conversation[];
    }>(`/api/users/${userId}/conversations`);
    return response.data.conversations;
  }

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId: string, title: string): Promise<Conversation> {
    const response = await this.client.put<{ 
      success: boolean; 
      conversation: Conversation;
    }>(`/api/conversations/${conversationId}/title`, { title });
    return response.data.conversation;
  }

  /**
   * Delete conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.client.delete(`/api/conversations/${conversationId}`);
  }

  /**
   * Get model configuration
   */
  async getModelConfig(): Promise<ModelConfig> {
    const response = await this.client.get<{ 
      success: boolean; 
      config: ModelConfig;
    }>('/api/model/config');
    return response.data.config;
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Retry a failed request with exponential backoff
   */
  async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: ApiError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as ApiError;
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Don't retry certain types of errors
        if (lastError.type === 'api_key_invalid' || lastError.type === 'validation_error') {
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), 10000);
        console.log(`Retrying request in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export the class for testing
export { ApiClient }; 