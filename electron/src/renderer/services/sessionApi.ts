import API_BASE_URL from './config';

export interface SessionCreate {
  title?: string;
  device_ip: string;
  device_port: number;
  llm_config_id?: string;
  metadata?: Record<string, any>;
}

export interface SessionUpdate {
  title?: string;
  device_ip?: string;
  device_port?: number;
  metadata?: Record<string, any>;
}

export interface MessageResponse {
  id: string;
  content: string;
  role: string;
  status: string;
  timestamp: string;
  session_id: string;
  metadata?: Record<string, any>;
}

export interface SessionResponse {
  id: string;
  user_id: string;
  title: string;
  device_ip: string;
  device_port: number;
  llm_config_id?: string;
  messages: MessageResponse[];
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface SessionConnectRequest {
  session_id: string;
}

export class SessionApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('auth_token');
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `请求失败: ${response.status}`);
    }

    return await response.json();
  }

  async getSessions(): Promise<SessionResponse[]> {
    return this.request<SessionResponse[]>('/sessions/list');
  }

  async createSession(sessionData: SessionCreate): Promise<SessionResponse> {
    return this.request<SessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getSession(sessionId: string): Promise<SessionResponse> {
    return this.request<SessionResponse>(`/sessions?session_id=${sessionId}`);
  }

  async updateSession(sessionId: string, sessionData: SessionUpdate): Promise<SessionResponse> {
    return this.request<SessionResponse>(`/sessions/update?session_id=${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(sessionData),
    });
  }

  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/sessions/delete?session_id=${sessionId}`, {
      method: 'DELETE',
    });
  }

  async renameSession(sessionId: string, title: string): Promise<{ message: string; new_title: string }> {
    return this.request<{ message: string; new_title: string }>(`/sessions/rename?session_id=${sessionId}&title=${encodeURIComponent(title)}`, {
      method: 'POST',
    });
  }

  async connectSession(request: SessionConnectRequest): Promise<SessionResponse> {
    return this.request<SessionResponse>('/sessions/connect', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}

export const sessionApi = new SessionApiService();