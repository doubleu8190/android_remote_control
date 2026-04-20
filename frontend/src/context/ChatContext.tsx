import React, { createContext, useContext, useState, useCallback, useEffect, useLayoutEffect, ReactNode } from 'react';
import { ChatSession, Message } from '../types/chat';
import { StorageService } from '../services/storage';

interface ChatContextType {
  sessions: ChatSession[];
  activeSessionId: string;
  isLoading: boolean;
  setActiveSessionId: (id: string) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (id: string, updates: Partial<ChatSession>) => void;
  deleteSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void;
  setIsLoading: (loading: boolean) => void;
  clearAllSessions: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化：从本地存储加载会话
  useLayoutEffect(() => {
    if (isInitialized) return;

    const savedSessions = StorageService.loadSessions();
    const savedActiveSessionId = StorageService.loadActiveSessionId();

    if (savedSessions.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessions(savedSessions);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSessionId(savedActiveSessionId || savedSessions[0].id);
    } else {
      // 创建默认会话
      const defaultSession: ChatSession = {
        id: '1',
        title: 'New Conversation',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSessions([defaultSession]);
      setActiveSessionId(defaultSession.id);
      StorageService.saveSessions([defaultSession]);
      StorageService.saveActiveSessionId(defaultSession.id);
    }
    setIsInitialized(true);
  }, [isInitialized]);

  // 保存会话到本地存储
  useEffect(() => {
    if (!isInitialized) return;
    StorageService.saveSessions(sessions);
  }, [sessions, isInitialized]);

  // 保存活跃会话ID
  useEffect(() => {
    if (!isInitialized || !activeSessionId) return;
    StorageService.saveActiveSessionId(activeSessionId);
  }, [activeSessionId, isInitialized]);

  const addSession = useCallback((session: ChatSession) => {
    setSessions(prev => [...prev, session]);
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<ChatSession>) => {
    setSessions(prev => prev.map(session =>
      session.id === id ? { ...session, ...updates, updatedAt: new Date() } : session
    ));
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(session => session.id !== id);
      if (filtered.length === 0) {
        // 如果删除了所有会话，创建一个新的
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'New Conversation',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setActiveSessionId(newSession.id);
        return [newSession];
      }
      return filtered;
    });
    StorageService.deleteSession(id);
  }, []);

  const addMessage = useCallback((sessionId: string, message: Message) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? {
            ...session,
            messages: [...session.messages, message],
            updatedAt: new Date(),
          }
        : session
    ));
  }, []);

  const updateMessage = useCallback((sessionId: string, messageId: string, updates: Partial<Message>) => {
    setSessions(prev => prev.map(session =>
      session.id === sessionId
        ? {
            ...session,
            messages: session.messages.map(msg =>
              msg.id === messageId ? { ...msg, ...updates } : msg
            ),
          }
        : session
    ));
  }, []);

  const clearAllSessions = useCallback(() => {
    const defaultSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSessions([defaultSession]);
    setActiveSessionId(defaultSession.id);
    StorageService.clearSessions();
    StorageService.saveSessions([defaultSession]);
    StorageService.saveActiveSessionId(defaultSession.id);
  }, []);

  const value = {
    sessions,
    activeSessionId,
    isLoading,
    setActiveSessionId,
    addSession,
    updateSession,
    deleteSession,
    addMessage,
    updateMessage,
    setIsLoading,
    clearAllSessions,
  };

  // 在初始化完成前显示加载状态
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Initializing chat interface...</p>
          <p className="text-sm text-gray-400 mt-2">Loading sessions and settings</p>
        </div>
      </div>
    );
  }

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};