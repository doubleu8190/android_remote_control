import React, { useState, KeyboardEvent, useRef } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
      
      // 重置textarea高度
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter 保持换行
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 自动调整高度
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  const handleInsertExample = () => {
    const examples = [
      "Explain the five-step compression strategy in simple terms.",
      "What is the role of the engine layer in this AI agent architecture?",
      "How does the MCP protocol work for tool communication?",
      "Can you summarize the context compression service functionality?",
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    setMessage(randomExample);
    
    // 触发高度调整
    setTimeout(() => {
      if (textareaRef.current) {
        handleInput();
      }
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Type your message here... (Shift+Enter for new line)"
          className="input-field min-h-[60px] max-h-[200px] resize-none pr-12"
          disabled={disabled}
          rows={1}
        />
        <div className="absolute right-2 bottom-2 flex gap-2">
          <button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            className="btn-primary px-4 py-2"
          >
            {disabled ? (
              <span className="flex items-center gap-2">
                <span className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={handleInsertExample}
            className="text-xs text-primary-600 hover:text-primary-800"
            disabled={disabled}
          >
            Insert Example
          </button>
          <button
            onClick={() => setMessage('')}
            className="text-xs text-gray-500 hover:text-gray-700"
            disabled={disabled || !message}
          >
            Clear
          </button>
        </div>
        <div className="text-xs text-gray-500">
          {message.length} characters
        </div>
      </div>
    </div>
  );
};

export default MessageInput;