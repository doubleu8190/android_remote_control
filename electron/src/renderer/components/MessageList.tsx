import { useState } from 'react';
import { MessageResponse } from '../services/sessionApi';

interface MessageListProps {
  messages: MessageResponse[];
  isLoading: boolean;
}

function parseDisplayContent(message: MessageResponse): string {
  if (message.role !== 'assistant') return message.content;
  try {
    const parsed = JSON.parse(message.content);
    return parsed.content || message.content;
  } catch {
    return message.content;
  }
}

const ToolMessageItem = ({ message }: { message: MessageResponse }) => {
  const [expanded, setExpanded] = useState(false);
  const toolName = message.metadata?.tool_name || 'Tool';
  const isLong = message.content.length > 120;

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm bg-orange-100 text-orange-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
            {toolName}
          </span>
        </div>
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 rounded-bl-none">
          {isLong && !expanded ? (
            <>
              <div className="whitespace-pre-wrap break-words line-clamp-3">{message.content}</div>
              <button
                onClick={() => setExpanded(true)}
                className="text-blue-500 hover:text-blue-700 text-xs mt-1"
              >
                Show more
              </button>
            </>
          ) : (
            <>
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
              {isLong && (
                <button
                  onClick={() => setExpanded(false)}
                  className="text-blue-500 hover:text-blue-700 text-xs mt-1"
                >
                  Show less
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const MessageItem = ({ message }: { message: MessageResponse }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const displayContent = parseDisplayContent(message);

  if (isTool) {
    return <ToolMessageItem message={message} />;
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm ${
        isUser ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
      }`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
            {isUser ? 'You' : 'AI Assistant'}
          </span>
          <span className="text-xs text-gray-500">{time}</span>
        </div>
        <div className={`p-3 rounded-2xl text-sm ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
        }`}>
          <div className="whitespace-pre-wrap break-words">{displayContent}</div>
        </div>
      </div>
    </div>
  );
};

const MessageList = ({ messages, isLoading }: MessageListProps) => {
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <div className="text-4xl mb-4">💬</div>
        <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">暂无消息</h3>
        <p className="text-sm text-gray-500">开始发送消息与AI助手交互</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
      {isLoading && (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <span>AI</span>
          </div>
          <div className="text-sm text-gray-500">Thinking...</div>
        </div>
      )}
    </div>
  );
};

export default MessageList;
