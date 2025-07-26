import { create } from 'zustand';
import { ChatState, Conversation, Message } from '../types';

interface ChatStore extends ChatState {
  sendMessage: (content: string, conversationId?: string) => Promise<void>;
  createConversation: (name: string, projectId?: string) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  addMessage: (message: Message) => void;
  setLoading: (loading: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  loadConversations: () => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentConversation: null,
  conversations: [],
  isLoading: false,
  isGenerating: false,
  error: null,

  sendMessage: async (content: string, conversationId?: string) => {
    const { currentConversation } = get();
    const targetConversationId = conversationId || currentConversation?.id;
    
    if (!targetConversationId) {
      // Create a new conversation if none exists
      await get().createConversation('New Conversation');
      return get().sendMessage(content);
    }

    set({ isGenerating: true, error: null });

    try {
      // Add user message immediately
      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: 'user',
        type: 'text',
        conversationId: targetConversationId,
        createdAt: new Date().toISOString(),
      };
      
      get().addMessage(userMessage);

      // TODO: Replace with actual API call
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          conversationId: targetConversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const aiMessage = await response.json();
      get().addMessage(aiMessage);
      
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
    } finally {
      set({ isGenerating: false });
    }
  },

  createConversation: async (name: string, projectId?: string) => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, projectId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const conversation = await response.json();
      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create conversation',
      });
    }
  },

  setCurrentConversation: (conversation: Conversation | null) => {
    set({ currentConversation: conversation });
  },

  addMessage: (message: Message) => {
    set((state) => {
      if (!state.currentConversation) return state;

      const updatedConversation = {
        ...state.currentConversation,
        messages: [...state.currentConversation.messages, message],
        updatedAt: new Date().toISOString(),
      };

      return {
        currentConversation: updatedConversation,
        conversations: state.conversations.map(conv =>
          conv.id === updatedConversation.id ? updatedConversation : conv
        ),
      };
    });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setGenerating: (isGenerating: boolean) => {
    set({ isGenerating });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  loadConversations: async () => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/conversations');
      
      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const conversations = await response.json();
      set({
        conversations,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversations',
      });
    }
  },
}));