/// <reference types="vite/client" />

import { SendMessageRequest, SendMessageResponse, ApiResponse, StreamChunk, SessionResponse, MessageResponse } from '../types/chat';
import { LoginResponse, UserInfo } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export class ChatApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  async sendMessage(request: SendMessageRequest): Promise<ApiResponse<SendMessageResponse>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/messages/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async sendMessageStream(
    request: SendMessageRequest,
    onChunk: (chunk: StreamChunk) => void,
    onError?: (error: string) => void,
    onComplete?: () => void
  ): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/messages/send/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          onComplete?.();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              onChunk(data);
            } catch (e) {
              console.error('Error parsing stream chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in stream:', error);
      onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async listSessions(): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions/`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error listing sessions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getSessions(): Promise<ApiResponse<SessionResponse[]>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions/`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting sessions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getSession(sessionId: string): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions?session_id=${encodeURIComponent(sessionId)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async createSession(data?: { title?: string; metadata?: Record<string, any>; device_ip?: string; device_port?: number }): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data || {}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      return {
        success: true,
        data: responseData,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error creating session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getMessages(sessionId: string): Promise<ApiResponse<MessageResponse[]>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/messages/history?session_id=${encodeURIComponent(sessionId)}`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting messages:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions/delete?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error deleting session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    try {
      // 注意：this.baseUrl 已经包含 /api，所以不需要再加 /api
      const response = await fetch(`${this.baseUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error checking health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async login(username: string, password: string): Promise<ApiResponse<LoginResponse>> {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid username or password');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error logging in:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        success: true,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error logging out:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async connectDevice(request?: { ip?: string; port?: number; session_id?: string }): Promise<ApiResponse<{ status: string; message: string; device_ip: string; device_port: number; websocket_url: string }>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      console.log('connectDevice request:', request);
      const response = await fetch(`${this.baseUrl}/sessions/device/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request|| {}),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error connecting device:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async connectSessionDevice(sessionId: string): Promise<ApiResponse<{ status: string; message: string; device_ip: string; device_port: number; websocket_url: string }>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions/connect?session_id=${encodeURIComponent(sessionId)}`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error connecting session device:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async updateSessionDevice(sessionId: string, deviceIp: string, devicePort: number): Promise<ApiResponse<{ message: string; device_ip: string; device_port: number }>> {
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${this.baseUrl}/sessions/device?session_id=${encodeURIComponent(sessionId)}&device_ip=${encodeURIComponent(deviceIp)}&device_port=${devicePort}`, {
        method: 'PUT',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error updating session device:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async getCurrentUser(): Promise<ApiResponse<UserInfo>> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${this.baseUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }

  async register(data: {
    username: string;
    email?: string;
    password: string;
    full_name?: string;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = `HTTP error! status: ${response.status}`;
        
        if (errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // 处理Pydantic验证错误数组
            errorMessage = errorData.detail.map((err: any) => err.msg || 'Validation error').join('\n');
          } else if (typeof errorData.detail === 'string') {
            // 处理普通字符串错误
            errorMessage = errorData.detail;
          }
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      return {
        success: true,
        data: responseData,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Error registering:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
    }
  }
}

// 单例实例
export const chatApiService = new ChatApiService();