import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatContainer from './ChatContainer';
import VideoStreamPlayer from './VideoStreamPlayer';
import { Message, MessageRole } from '../types/chat';
import { chatApiService } from '../services/api';

const SessionDetailPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [videoStreamUrl, setVideoStreamUrl] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');

  // 加载会话详情和消息
  const loadSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setLoadingMessages(true);
      setMessageError(null);
      
      // 加载消息
      const result = await chatApiService.getMessages(sessionId);
      
      if (result.success && result.data) {
        const messageList = Array.isArray(result.data) ? result.data : [result.data];
        // 转换MessageResponse为Message
        const convertedMessages: Message[] = messageList.map(msg => ({
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

  // 连接设备并获取视频流
  const connectToDevice = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      setConnecting(true);
      setConnectionError('');
      
      // 调用快速连接API
      const connectResult = await chatApiService.connectSessionDevice(sessionId);
      if (!connectResult.success || !connectResult.data) {
        throw new Error(connectResult.error || '连接设备失败');
      }
      
      // 更新视频流URL
      const scrcpyWsUrl = connectResult.data.websocket_url || `ws://${window.location.hostname}:8190`;
      setVideoStreamUrl(scrcpyWsUrl);
      
      console.log('设备连接成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接设备失败，请检查设备是否可用';
      setConnectionError(errorMessage);
      console.error('设备连接失败:', error);
    } finally {
      setConnecting(false);
    }
  }, [sessionId]);

  // 初始化加载
  useEffect(() => {
    if (sessionId) {
      loadSessionDetails();
      connectToDevice();
    }
  }, [sessionId, loadSessionDetails, connectToDevice]);



  const handleSendMessage = async (content: string) => {
    if (!sessionId) return;
    
    try {
      // 添加用户消息到本地状态
      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: 'user' as MessageRole,
        timestamp: new Date(),
        status: 'sending',
      };
      setMessages(prev => [...prev, userMessage]);
      
      // 调用API发送消息
      const result = await chatApiService.sendMessage({
        session_id: sessionId,
        message: content,
        stream: false,
      });
      
      if (result.success && result.data) {
        // 添加AI回复到本地状态
        const aiMessage: Message = {
          id: result.data.messageId || `ai-${Date.now()}`,
          content: result.data.content,
          role: result.data.role as MessageRole,
          timestamp: new Date(result.data.timestamp),
          status: 'delivered',
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // 显示错误
        setMessageError(result.error || 'Failed to send message');
        // 更新用户消息状态为错误
        setMessages(prev => prev.map(msg => 
          msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
        ));
      }
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : 'Send message error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左侧聊天区域 */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">聊天记录</h2>
            </div>
            <div className="h-[700px]">
              <ChatContainer
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={loadingMessages}
              />
              {messageError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
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
          
          {/* 右侧投屏区域 */}
          <div className="w-full lg:w-1/3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">设备投屏</h2>
            </div>
            <div className="h-[700px] relative">
              {connecting ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">正在连接设备...</p>
                  </div>
                </div>
              ) : connectionError ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                  <div className="text-center p-6">
                    <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.633-1.964-.633-2.732 0L3.34 16c-.77.633.192 3 1.732 3z" />
                    </svg>
                    <p className="text-red-600 dark:text-red-400 mb-4">{connectionError}</p>
                    <button
                      onClick={connectToDevice}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      重新连接
                    </button>
                  </div>
                </div>
              ) : (
                <VideoStreamPlayer 
                  wsUrl={videoStreamUrl || `ws://${window.location.hostname}:8190`}
                  autoConnect={!!videoStreamUrl}
                  onConnectionChange={(connected) => {
                    console.log(`视频流连接状态: ${connected ? '已连接' : '已断开'}`);
                  }}
                  onError={(error) => {
                    console.error('视频流错误:', error);
                    setConnectionError('视频流连接失败');
                  }}
                  className="w-full h-full"
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SessionDetailPage;