import { ChatSession } from '../types/chat';

const STORAGE_KEY = 'ai_chat_sessions';
const MAX_SESSIONS = 50;

export class StorageService {
  static saveSessions(sessions: ChatSession[]): void {
    try {
      const sessionsToSave = sessions.slice(0, MAX_SESSIONS);
      const serialized = sessionsToSave.map(session => ({
        ...session,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        })),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (error) {
      console.error('Error saving sessions to localStorage:', error);
    }
  }

  static loadSessions(): ChatSession[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }

      const parsed = JSON.parse(data);
      return parsed.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }));
    } catch (error) {
      console.error('Error loading sessions from localStorage:', error);
      return [];
    }
  }

  static saveSession(session: ChatSession): void {
    try {
      const sessions = this.loadSessions();
      const existingIndex = sessions.findIndex(s => s.id === session.id);

      if (existingIndex >= 0) {
        sessions[existingIndex] = session;
      } else {
        sessions.unshift(session);
      }

      // 保持最多MAX_SESSIONS个会话
      const sessionsToKeep = sessions.slice(0, MAX_SESSIONS);
      this.saveSessions(sessionsToKeep);
    } catch (error) {
      console.error('Error saving session to localStorage:', error);
    }
  }

  static deleteSession(sessionId: string): void {
    try {
      const sessions = this.loadSessions();
      const filtered = sessions.filter(session => session.id !== sessionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting session from localStorage:', error);
    }
  }

  static clearSessions(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing sessions from localStorage:', error);
    }
  }

  static saveActiveSessionId(sessionId: string): void {
    try {
      localStorage.setItem('active_session_id', sessionId);
    } catch (error) {
      console.error('Error saving active session ID:', error);
    }
  }

  static loadActiveSessionId(): string | null {
    try {
      return localStorage.getItem('active_session_id');
    } catch (error) {
      console.error('Error loading active session ID:', error);
      return null;
    }
  }

  static saveSettings(settings: any): void {
    try {
      localStorage.setItem('chat_settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  static loadSettings(): any {
    try {
      const data = localStorage.getItem('chat_settings');
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error loading settings:', error);
      return {};
    }
  }

  static getStorageInfo(): {
    totalSessions: number;
    totalMessages: number;
    storageUsed: number;
  } {
    try {
      const sessions = this.loadSessions();
      const totalMessages = sessions.reduce(
        (sum, session) => sum + session.messages.length,
        0
      );
      
      // 估算存储使用量
      const data = localStorage.getItem(STORAGE_KEY) || '';
      const storageUsed = new Blob([data]).size;

      return {
        totalSessions: sessions.length,
        totalMessages,
        storageUsed,
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return {
        totalSessions: 0,
        totalMessages: 0,
        storageUsed: 0,
      };
    }
  }
}