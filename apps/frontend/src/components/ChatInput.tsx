import React, { useState, useRef, KeyboardEvent } from 'react';
import { Send, Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isGenerating?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isGenerating = false,
  disabled = false,
  placeholder = "Ask Claude anything...",
  className
}) => {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isGenerating || disabled) return;
    
    onSendMessage(trimmedMessage);
    setMessage('');
    
    // Focus back to input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceToggle = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      // TODO: Stop speech recognition
      console.log('Voice input stopped');
    } else {
      setIsListening(true);
      // TODO: Start speech recognition
      console.log('Voice input started');
      
      // Mock implementation - remove when implementing real speech recognition
      setTimeout(() => {
        setIsListening(false);
        console.log('Voice input mock completed');
      }, 3000);
    }
  };

  const canSend = message.trim().length > 0 && !isGenerating && !disabled;

  return (
    <div className={cn("border-t bg-background p-4", className)}>
      <div className="mx-auto max-w-4xl">
        <div className="flex gap-2 items-end">
          {/* Voice input button */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleVoiceToggle}
            disabled={disabled || isGenerating}
            className={cn(
              "flex-shrink-0 transition-colors",
              isListening && "bg-red-100 border-red-300 text-red-600 hover:bg-red-200"
            )}
            title={isListening ? "Stop voice input" : "Start voice input"}
          >
            {isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {/* Message input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={placeholder}
              disabled={disabled || isGenerating}
              className="pr-12 min-h-[44px] resize-none"
              autoFocus
            />
            
            {/* Character count indicator for long messages */}
            {message.length > 100 && (
              <div className="absolute bottom-1 right-14 text-xs text-muted-foreground">
                {message.length}/2000
              </div>
            )}
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!canSend}
            size="icon"
            className="flex-shrink-0"
            title="Send message (Enter)"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Status indicators */}
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {isListening && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span>Listening...</span>
              </div>
            )}
            
            {isGenerating && (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Claude is responding...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span>Press Enter to send</span>
            {message.length > 0 && (
              <span>• {message.length} chars</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput; 