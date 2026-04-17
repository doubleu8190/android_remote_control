import React, { useRef, useEffect } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { Message } from '../types/chat';

interface ChatContainerProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  onSendMessage,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClearChat = () => {
    if (window.confirm('Are you sure you want to clear all messages in this conversation?')) {
      // 这里需要实现清空消息的逻辑
      console.log('Clearing chat...');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">AI Chat</h2>
          <p className="text-sm text-gray-500">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClearChat}
            className="btn-secondary text-sm px-3 py-1.5"
            disabled={messages.length === 0}
          >
            Clear Chat
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto p-4"
        >
          <MessageList messages={messages} isLoading={isLoading} />
        </div>
      </div>
      <div className="p-4 border-t border-gray-200">
        <MessageInput
          onSendMessage={onSendMessage}
          disabled={isLoading}
        />
        <div className="mt-2 text-xs text-gray-500 flex justify-between">
          <span>
            Press <kbd className="px-1 py-0.5 bg-gray-100 rounded border">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-100 rounded border">Shift+Enter</kbd> for new line
          </span>
          <span>
            {isLoading ? 'AI is thinking...' : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatContainer;