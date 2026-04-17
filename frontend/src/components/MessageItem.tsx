import React, { useState } from 'react';
import { Message } from '../types/chat';

interface MessageItemProps {
  message: Message;
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isUser = message.role === 'user';

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending': return '🔄';
      case 'sent': return '✓';
      case 'delivered': return '✓✓';
      case 'read': return '👁️';
      case 'error': return '❌';
      default: return '';
    }
  };

  const formatContent = (content: string) => {
    // 简单的格式化处理
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const shouldTruncate = message.content.length > 500;
  const displayContent = shouldTruncate && !isExpanded 
    ? message.content.substring(0, 500) + '...' 
    : message.content;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary-100 text-primary-800' : 'bg-gray-200 text-gray-700'}`}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-700">
            {isUser ? 'You' : 'AI Assistant'}
          </span>
          <span className="text-xs text-gray-500">
            {formatTime(message.timestamp)}
          </span>
          {isUser && (
            <span className="text-xs text-gray-400">
              {getStatusIcon(message.status)}
            </span>
          )}
        </div>
        <div
          className={`p-4 rounded-2xl ${isUser
            ? 'bg-primary-100 text-primary-900 rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
            }`}
        >
          <div className="whitespace-pre-wrap break-words">
            {formatContent(displayContent)}
          </div>
          {shouldTruncate && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
        {message.metadata && Object.keys(message.metadata).length > 0 && (
          <div className="mt-1 text-xs text-gray-500">
            {message.metadata.tool && (
              <span>Tool: {message.metadata.tool}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;