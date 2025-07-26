import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../services/api';
import {
  ChatState,
  Conversation,
  Message,
  SendMessageRequest,
  ApiError,
  StreamingChunk
} from '../types';

interface ChatActions {
  // Conversation management
  createConversation: (title?: string, projectId?: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  loadConversationMessages: (conversationId: string) => Promise<void>;

  // Message handling
  sendMessage: (content: string, useStreaming?: boolean) => Promise<void>;
  addMessage: (message: Message) => void;
  updateStreamingMessage: (messageId: string, content: string) => void;
  completeStreamingMessage: (messageId: string, finalMessage: Message) => void;

  // State management
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Utils
  generateConversationId: () => string;
  generateMessageId: () => string;
}

type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentConversation: null,
      conversations: [],
      messages: {},
      isLoading: false,
      isGenerating: false,
      error: null,
      streamingMessageId: null,

      // Conversation management
      createConversation: async (title = 'New Conversation', projectId) => {
        try {
          set({ isLoading: true, error: null });
          
          const conversation = await apiClient.createConversation(title, projectId);
          
          set((state) => ({
            conversations: [conversation, ...state.conversations],
            currentConversation: conversation,
            messages: {
              ...state.messages,
              [conversation.id]: []
            },
            isLoading: false
          }));

          console.log('✅ Conversation created:', conversation.id);
        } catch (error) {
          const apiError = error as ApiError;
          console.error('❌ Failed to create conversation:', apiError);
          set({ error: apiError.message, isLoading: false });
        }
      },

      loadConversations: async () => {
        try {
          set({ isLoading: true, error: null });
          
          const conversations = await apiClient.getConversations();
          
          set({
            conversations,
            isLoading: false
          });

          console.log('✅ Conversations loaded:', conversations.length);
        } catch (error) {
          const apiError = error as ApiError;
          console.error('❌ Failed to load conversations:', apiError);
          set({ error: apiError.message, isLoading: false });
        }
      },

      setCurrentConversation: (conversation) => {
        set({ currentConversation: conversation });
        
        // Load messages if we don't have them yet
        if (conversation && !get().messages[conversation.id]) {
          get().loadConversationMessages(conversation.id);
        }
      },

      loadConversationMessages: async (conversationId) => {
        try {
          set({ isLoading: true, error: null });
          
          const { messages } = await apiClient.getConversation(conversationId);
          
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: messages
            },
            isLoading: false
          }));

          console.log('✅ Messages loaded for conversation:', conversationId, messages.length);
        } catch (error) {
          const apiError = error as ApiError;
          console.error('❌ Failed to load messages:', apiError);
          set({ error: apiError.message, isLoading: false });
        }
      },

      // Message handling
      sendMessage: async (content, useStreaming = true) => {
        const state = get();
        
        if (!state.currentConversation) {
          // Create a new conversation if none exists
          await get().createConversation();
          const newState = get();
          if (!newState.currentConversation) {
            set({ error: 'Failed to create conversation' });
            return;
          }
        }

        const conversation = get().currentConversation!;
        const userMessageId = get().generateMessageId();
        
        // Create user message
        const userMessage: Message = {
          id: userMessageId,
          role: 'user',
          content,
          timestamp: new Date().toISOString(),
          conversationId: conversation.id
        };

        // Add user message immediately
        get().addMessage(userMessage);

        // Prepare API request
        const request: SendMessageRequest = {
          message: content,
          conversationId: conversation.id,
          context: {
            projectId: conversation.projectId
          }
        };

                 try {
           set({ isGenerating: true, error: null });

           if (useStreaming) {
             // Handle streaming response
             const assistantMessageId = get().generateMessageId();
             
             // Create initial assistant message
             const assistantMessage: Message = {
               id: assistantMessageId,
               role: 'assistant',
               content: '',
               timestamp: new Date().toISOString(),
               conversationId: request.conversationId
             };

             get().addMessage(assistantMessage);
             set({ streamingMessageId: assistantMessageId });

             await apiClient.sendStreamingMessage(
               request,
               // On chunk received
               (chunk: StreamingChunk) => {
                 if (chunk.content) {
                   get().updateStreamingMessage(assistantMessageId, chunk.content);
                 }
               },
               // On complete
               (finalMessage: Message) => {
                 get().completeStreamingMessage(assistantMessageId, finalMessage);
                 set({ isGenerating: false, streamingMessageId: null });
                 console.log('✅ Streaming message completed');
               },
               // On error
               (error: ApiError) => {
                 set({ 
                   error: error.message, 
                   isGenerating: false, 
                   streamingMessageId: null 
                 });
                 console.error('❌ Streaming error:', error);
               }
             );
           } else {
             // Handle regular (non-streaming) response
             const response = await apiClient.sendMessage(request);
             get().addMessage(response.message);
             set({ isGenerating: false });
             console.log('✅ Regular message completed');
           }
         } catch (error) {
           const apiError = error as ApiError;
           console.error('❌ Failed to send message:', apiError);
           set({ error: apiError.message, isGenerating: false });
         }
       },

      addMessage: (message) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [message.conversationId]: [
              ...(state.messages[message.conversationId] || []),
              message
            ]
          }
        }));
      },

      updateStreamingMessage: (messageId, additionalContent) => {
        set((state) => {
          const conversationId = state.currentConversation?.id;
          if (!conversationId) return state;

          const messages = state.messages[conversationId] || [];
          const updatedMessages = messages.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: msg.content + additionalContent }
              : msg
          );

          return {
            messages: {
              ...state.messages,
              [conversationId]: updatedMessages
            }
          };
        });
      },

      completeStreamingMessage: (messageId, finalMessage) => {
        set((state) => {
          const conversationId = state.currentConversation?.id;
          if (!conversationId) return state;

          const messages = state.messages[conversationId] || [];
          const updatedMessages = messages.map(msg => 
            msg.id === messageId 
              ? { ...msg, ...finalMessage, id: messageId }
              : msg
          );

          return {
            messages: {
              ...state.messages,
              [conversationId]: updatedMessages
            }
          };
        });
      },

      // State management
      setLoading: (loading) => set({ isLoading: loading }),
      setGenerating: (generating) => set({ isGenerating: generating }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Utilities
      generateConversationId: () => {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },

      generateMessageId: () => {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },

      
    }),
    {
      name: 'chat-store',
    }
  )
);

// Export some utility functions for external use
export const chatUtils = {
  getCurrentMessages: (conversationId: string | undefined) => {
    if (!conversationId) return [];
    return useChatStore.getState().messages[conversationId] || [];
  },
  
  isStreamingActive: () => {
    return useChatStore.getState().streamingMessageId !== null;
  },
  
  getLastMessage: (conversationId: string | undefined) => {
    const messages = chatUtils.getCurrentMessages(conversationId);
    return messages[messages.length - 1] || null;
  }
}; 