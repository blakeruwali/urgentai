import React, { useState } from 'react';
import { Copy, User, Bot, CheckCircle, AlertCircle, Code } from 'lucide-react';
import { Button } from './ui/Button';
import { cn, formatTimestamp, extractCodeBlocks, copyToClipboard } from '@/lib/utils';
import { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  className?: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-4 rounded-lg border bg-gray-100">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <span className="text-sm font-medium text-gray-700">
            {language || 'Code'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2"
        >
          {copied ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="ml-1 text-xs">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm text-gray-900">{code}</code>
      </pre>
    </div>
  );
};

const MessageContent: React.FC<{ content: string; isStreaming?: boolean }> = ({ 
  content, 
  isStreaming 
}) => {
  const codeBlocks = extractCodeBlocks(content);
  
  if (codeBlocks.length === 0) {
    return (
      <div className="prose prose-sm max-w-none text-gray-900">
        <div className="whitespace-pre-wrap">{content}</div>
        {isStreaming && (
          <span className="inline-block animate-pulse ml-1">▋</span>
        )}
      </div>
    );
  }

  // Split content by code blocks and render
  let remainingContent = content;
  const parts: React.ReactNode[] = [];

  codeBlocks.forEach((block, index) => {
    const blockPattern = new RegExp(`\`\`\`${block.language}?\n?${block.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`\`\``, 'g');
    const beforeBlock = remainingContent.split(blockPattern)[0];
    
    if (beforeBlock) {
      parts.push(
        <div key={`text-${index}`} className="whitespace-pre-wrap">
          {beforeBlock}
        </div>
      );
    }
    
    parts.push(
      <CodeBlock 
        key={`code-${index}`} 
        language={block.language} 
        code={block.code} 
      />
    );
    
    remainingContent = remainingContent.replace(beforeBlock + `\`\`\`${block.language || ''}\n${block.code}\`\`\``, '');
  });

  // Add any remaining content
  if (remainingContent.trim()) {
    parts.push(
      <div key="text-final" className="whitespace-pre-wrap">
        {remainingContent}
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none text-gray-900">
      {parts}
      {isStreaming && (
        <span className="inline-block animate-pulse ml-1">▋</span>
      )}
    </div>
  );
};

const StreamingIndicator: React.FC = () => (
  <div className="flex items-center gap-2 text-gray-500">
    <div className="flex gap-1">
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
    </div>
    <span className="text-sm">Claude is thinking...</span>
  </div>
);

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  isStreaming = false, 
  className 
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isError = message.role === 'system' && message.content.includes('Error');

  return (
    <div className={cn("group relative", className)}>
      <div className={cn(
        "flex gap-3 p-4 rounded-lg transition-colors",
        isUser && "bg-blue-50 ml-8",
        isAssistant && "bg-gray-50 mr-8",
        isError && "bg-red-50 border border-red-200"
      )}>
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser && "bg-blue-600 text-white",
          isAssistant && "bg-gray-600 text-white",
          isError && "bg-red-600 text-white"
        )}>
          {isUser && <User className="h-4 w-4" />}
          {isAssistant && <Bot className="h-4 w-4" />}
          {isError && <AlertCircle className="h-4 w-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">
              {isUser && "You"}
              {isAssistant && "Claude"}
              {isError && "Error"}
            </span>
            <span className="text-xs text-gray-500">
              {formatTimestamp(message.timestamp)}
            </span>
            {message.metadata?.tokens_used && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {message.metadata.tokens_used} tokens
              </span>
            )}
          </div>

          {/* Message content */}
          {isStreaming && !message.content ? (
            <StreamingIndicator />
          ) : (
            <MessageContent 
              content={message.content} 
              isStreaming={isStreaming}
            />
          )}

          {/* Processing time for assistant messages */}
          {isAssistant && message.metadata?.processing_time && (
            <div className="mt-2 text-xs text-gray-500">
              Processed in {message.metadata.processing_time}ms
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage; 