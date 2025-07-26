import React, { useEffect, useRef } from 'react';
import { MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { useChatStore, chatUtils } from '@/stores/chatStore';
import { cn } from '@/lib/utils';

interface ChatProps {
  className?: string;
}

const EmptyState: React.FC<{ onStartChat: () => void }> = ({ onStartChat }) => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
        <MessageSquare className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Welcome to Claude Chat</h2>
      <p className="text-muted-foreground mb-6">
        Start a conversation with Claude, your AI assistant for app development. 
        Ask questions, generate code, or get help with your projects.
      </p>
      <Button onClick={onStartChat}>
        Start New Conversation
      </Button>
    </div>
  </div>
);

const ErrorState: React.FC<{ error: string; onRetry: () => void; onClear: () => void }> = ({ 
  error, 
  onRetry, 
  onClear 
}) => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-muted-foreground mb-6">{error}</p>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={onClear}>
          Dismiss
        </Button>
        <Button onClick={onRetry}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    </div>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-muted-foreground">Loading conversation...</p>
    </div>
  </div>
);

const Chat: React.FC<ChatProps> = ({ className }) => {
  const {
    currentConversation,
    conversations,
    messages,
    isLoading,
    isGenerating,
    error,
    streamingMessageId,
    createConversation,
    sendMessage,
    clearError,
    loadConversations
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentConversation?.id]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Get current conversation messages
  const currentMessages = chatUtils.getCurrentMessages(currentConversation?.id);
  const isStreamingActive = chatUtils.isStreamingActive();

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, true); // Use streaming by default
  };

  const handleStartNewConversation = async () => {
    await createConversation();
  };

  const handleRetry = () => {
    clearError();
    // Optionally retry the last action
  };

  // Show loading state
  if (isLoading && !currentConversation) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <LoadingState />
      </div>
    );
  }

  // Show error state if there's an error and no conversation
  if (error && !currentConversation) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <ErrorState 
          error={error} 
          onRetry={handleRetry} 
          onClear={clearError} 
        />
      </div>
    );
  }

  // Show empty state if no conversation
  if (!currentConversation && conversations.length === 0) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <EmptyState onStartChat={handleStartNewConversation} />
        <ChatInput
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          placeholder="Ask Claude anything to start a new conversation..."
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
      >
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Conversation header */}
          {currentConversation && (
            <div className="text-center py-4 border-b">
              <h2 className="text-lg font-semibold">{currentConversation.title}</h2>
              <p className="text-sm text-muted-foreground">
                Conversation with Claude • {currentMessages.length} messages
              </p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">Error</span>
              </div>
              <p className="text-sm text-destructive mt-1">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearError}
                className="mt-2"
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Messages */}
          {currentMessages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={streamingMessageId === message.id && isStreamingActive}
            />
          ))}

          {/* Loading indicator for new conversation */}
          {isGenerating && !isStreamingActive && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                <span className="ml-2">Claude is thinking...</span>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <ChatInput
        onSendMessage={handleSendMessage}
        isGenerating={isGenerating}
        placeholder={
          currentConversation 
            ? "Continue the conversation..." 
            : "Ask Claude anything to start a new conversation..."
        }
      />
    </div>
  );
};

export default Chat; 