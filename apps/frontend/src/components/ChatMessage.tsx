import { Message } from '../types';
import { clsx } from 'clsx';
import { User, Bot, Code, AlertCircle } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isError = message.type === 'error';
  const isCode = message.type === 'code';

  const getIcon = () => {
    if (isError) return <AlertCircle className="w-5 h-5 text-destructive" />;
    if (isCode) return <Code className="w-5 h-5 text-primary" />;
    if (isUser) return <User className="w-5 h-5 text-primary" />;
    return <Bot className="w-5 h-5 text-secondary-foreground" />;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={clsx(
      'flex w-full mb-4',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      <div className={clsx(
        'flex max-w-[80%] gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}>
        {/* Avatar */}
        <div className={clsx(
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-secondary text-secondary-foreground'
        )}>
          {getIcon()}
        </div>

        {/* Message Content */}
        <div className={clsx(
          'flex flex-col',
          isUser ? 'items-end' : 'items-start'
        )}>
          <div className={clsx(
            'rounded-lg px-4 py-2 max-w-full',
            isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground',
            isError && 'bg-destructive text-destructive-foreground',
            isCode && 'bg-accent text-accent-foreground font-mono text-sm'
          )}>
            {isCode ? (
              <pre className="whitespace-pre-wrap overflow-x-auto">
                <code>{message.content}</code>
              </pre>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{formatTime(message.createdAt)}</span>
            {message.metadata?.codeGenerated && (
              <span className="bg-primary/10 text-primary px-2 py-1 rounded">
                Code Generated
              </span>
            )}
            {message.metadata?.filesCreated && message.metadata.filesCreated.length > 0 && (
              <span className="bg-secondary/50 text-secondary-foreground px-2 py-1 rounded">
                {message.metadata.filesCreated.length} files created
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}