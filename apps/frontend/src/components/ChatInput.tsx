import { useState, KeyboardEvent } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Send, Mic, MicOff } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

interface ChatInputProps {
  onSendMessage?: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const { isGenerating, sendMessage } = useChatStore();

  const handleSend = async () => {
    if (!message.trim() || disabled || isGenerating) return;

    const messageToSend = message.trim();
    setMessage('');

    if (onSendMessage) {
      onSendMessage(messageToSend);
    } else {
      await sendMessage(messageToSend);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceToggle = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      // TODO: Implement voice recording stop logic
    } else {
      // Start recording
      setIsRecording(true);
      // TODO: Implement voice recording start logic
    }
  };

  const isDisabled = disabled || isGenerating;

  return (
    <div className="flex items-center gap-2 p-4 border-t border-border bg-background">
      <div className="flex-1 relative">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isGenerating ? "AI is generating..." : "Type your message..."}
          disabled={isDisabled}
          className="pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 transform -translate-y-1/2"
          onClick={handleVoiceToggle}
          disabled={isDisabled}
        >
          {isRecording ? (
            <MicOff className="w-4 h-4 text-destructive" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      <Button
        onClick={handleSend}
        disabled={!message.trim() || isDisabled}
        size="icon"
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}