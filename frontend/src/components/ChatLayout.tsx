import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SessionList from './SessionList';
import ChatContainer from './ChatContainer';
import { SessionResponse, Message, MessageRole } from '../types/chat';
import { chatApiService } from '../services/api';

const ChatLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      setSessionError(null);
      
      const result = await chatApiService.getSessions();
      
      if (result.success && result.data) {
        const sessionList = Array.isArray(result.data) ? result.data : [result.data];
        setSessions(sessionList);
        
        // 如果没有选中的会话，选择第一个
        if (sessionList.length > 0 && !selectedSessionId) {
          setSelectedSessionId(sessionList[0].id);
        }
      } else {
        setSessionError(result.error || 'Failed to load sessions');
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // 加载消息
  const loadMessages = useCallback(async (sessionId: string) => {
    if (!sessionId) return;
    
    try {
      setLoadingMessages(true);
      setMessageError(null);
      
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
  }, []);

  // 初始化加载会话
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 当选中会话变化时加载消息
  useEffect(() => {
    if (selectedSessionId) {
      loadMessages(selectedSessionId);
    } else {
      setMessages([]);
      setMessageError(null);
    }
  }, [selectedSessionId]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleCreateNewSession = async () => {
    // 防止重复提交
    if (creatingSession) {
      return;
    }

    try {
      setCreatingSession(true);
      const now = new Date();
      const title = `New Chat ${now.toLocaleString()}`;
      const result = await chatApiService.createSession({
        title,
        metadata: { 
          engine: 'basic',
          timestamp: now.getTime() // 添加时间戳防止重复
        }
      });

      if (result.success && result.data) {
        // 先选择新创建的会话，再加载会话列表
        setSelectedSessionId(result.data.id);
        // 重新加载会话列表
        await loadSessions();
      }
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setCreatingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatApiService.deleteSession(sessionId);
      
      // 从列表中移除
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // 如果删除的是当前选中的会话，选择另一个会话
      if (selectedSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setSelectedSessionId(remainingSessions[0].id);
        } else {
          setSelectedSessionId(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedSessionId) return;
    
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
        session_id: selectedSessionId,
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

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
      <div className="flex-1 flex">
        {/* 侧边栏 */}
        <div className={`${sidebarCollapsed ? 'w-16' : 'w-80'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}>
          {/* 用户信息 */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-900 dark:text-white">{user?.username}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email || 'AI Chat User'}</p>
                  </div>
                </div>
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Collapse sidebar"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mb-2">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Expand sidebar"
                >
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* 会话列表区域 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <SessionList
              sessions={sessions}
              selectedSessionId={selectedSessionId}
              loading={loadingSessions}
              error={sessionError}
              onSelect={handleSessionSelect}
              onCreateNew={handleCreateNewSession}
              onDelete={handleDeleteSession}
              collapsed={sidebarCollapsed}
              creating={creatingSession}
            />
          </div>

          {/* 底部操作 */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            {!sidebarCollapsed ? (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            ) : (
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 主聊天区域 */}
        <div className="flex-1 flex flex-col">
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Agent Chat Interface</h1>
                <p className="text-gray-600 dark:text-gray-300">Powered by LangChain Engine</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedSessionId 
                      ? sessions.find(s => s.id === selectedSessionId)?.title || 'Chat Session'
                      : 'No session selected'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.username} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <button
                  id="theme-toggle"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  aria-label="Toggle dark mode"
                  onClick={() => {
                    if (document.documentElement.classList.contains('dark')) {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('theme', 'light');
                    } else {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('theme', 'dark');
                    }
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                </button>
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-hidden min-h-0">
            {selectedSessionId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full">
                  <ChatContainer
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={loadingMessages}
                />
                {messageError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    <p className="text-sm">{messageError}</p>
                    <button
                      onClick={() => selectedSessionId && loadMessages(selectedSessionId)}
                      className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
                </div>
              </div>
            ) : (
              <div className="h-[600px] sm:h-[700px] flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No chat session selected</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Select a session from the sidebar or create a new one</p>
                  <button
                    onClick={handleCreateNewSession}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create New Session
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
  );
};

export default ChatLayout;