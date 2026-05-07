import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatContainer from './ChatContainer';
import AdbScreenCast from './AdbScreenCast';
import { Message, MessageRole, StreamChunk } from '../types/chat';
import { chatApiService } from '../services/api';

const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');

  const loadSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setLoadingMessages(true);
      setMessageError(null);
      
      const sessionResult = await chatApiService.getSession(sessionId);
      if (sessionResult.success && sessionResult.data) {
        setSessionTitle(sessionResult.data.title || '');
      }

      const result = await chatApiService.getMessages(sessionId);
      
      if (result.success && result.data) {
        const messageList = Array.isArray(result.data) ? result.data : [result.data];
        const convertedMessages: Message[] = messageList
          .filter(msg => msg.role !== 'tool') // Filter out tool messages (embedded in assistant metadata)
          .map(msg => ({
            id: msg.id,
            content: msg.content,
            role: msg.role as MessageRole,
            timestamp: new Date(msg.timestamp),
            status: 'delivered',
            metadata: msg.metadata,
          }));
        setMessages(convertedMessages);
      } else {
        setMessageError(result.error || 'Failed to load messages');
      }
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingMessages(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      loadSessionDetails();
    }
  }, [sessionId, loadSessionDetails]);

  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user' as MessageRole,
      timestamp: new Date(),
      status: 'sending',
    };
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessage: Message = {
      id: aiMessageId,
      content: '',
      role: 'assistant' as MessageRole,
      timestamp: new Date(),
      status: 'sending',
      metadata: { tool_calls: [] },
    };

    setMessages(prev => [...prev, userMessage, aiMessage]);

    // Use streaming to show tool calls in real-time
    await chatApiService.sendMessageStream(
      { session_id: sessionId, message: content },
      (chunk: StreamChunk) => {
        if (chunk.type === 'tool_call') {
          const tc = JSON.parse(chunk.data);
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId && msg.metadata) {
              return {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  tool_calls: [
                    ...(msg.metadata.tool_calls || []),
                    { ...tc, id: chunk.messageId, status: 'running' },
                  ],
                },
              };
            }
            return msg;
          }));
        } else if (chunk.type === 'tool_result') {
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId && msg.metadata?.tool_calls) {
              const updatedCalls = msg.metadata.tool_calls.map((tc: any) => {
                if (tc.id === chunk.messageId) {
                  return { ...tc, result: chunk.data, status: 'completed' };
                }
                return tc;
              });
              return { ...msg, metadata: { ...msg.metadata, tool_calls: updatedCalls } };
            }
            return msg;
          }));
        } else if (chunk.type === 'text') {
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) {
              return { ...msg, content: chunk.data, status: 'delivered' };
            }
            return msg;
          }));
        } else if (chunk.type === 'error') {
          setMessageError(chunk.data);
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) return { ...msg, status: 'error' };
            if (msg.id === userMessage.id) return { ...msg, status: 'sent' };
            return msg;
          }));
        } else if (chunk.type === 'done') {
          setMessages(prev => prev.map(msg => {
            if (msg.id === aiMessageId) return { ...msg, status: 'delivered' };
            if (msg.id === userMessage.id) return { ...msg, status: 'sent' };
            return msg;
          }));
        }
      },
      (error) => setMessageError(error),
    );
  };

  return (
    <div className="h-full flex flex-col">
      {sessionTitle && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {sessionTitle}
          </h2>
        </div>
      )}
      <div className="flex-1 flex gap-4 p-4 min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">聊天记录</h3>
          </div>
          <div className="flex-1 min-h-0">
            <ChatContainer
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={loadingMessages}
            />
            {messageError && (
              <div className="m-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                <p className="text-sm">{messageError}</p>
                <button
                  onClick={loadSessionDetails}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  重试
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 lg:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">设备投屏</h3>
          </div>
          <div className="flex-1 min-h-0 bg-gray-900">
            {sessionId && (
              <AdbScreenCast
                sessionId={sessionId}
                className="w-full h-full"
                maxFps={8}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPage;
