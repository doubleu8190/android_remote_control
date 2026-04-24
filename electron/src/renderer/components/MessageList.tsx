import { MessageResponse } from '../services/sessionApi';

interface MessageListProps {
  messages: MessageResponse[];
  isLoading: boolean;
}

const MessageItem = ({ message }: { message: MessageResponse }) => {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
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
