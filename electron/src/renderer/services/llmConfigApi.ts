const API_BASE_URL = 'http://localhost:8080/api';

export interface LLMConfigResponse {
  id: string;
  user_id: string;
  base_url: string;
  model: string;
  temperature: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMConfigCreate {
  base_url: string;
  model: string;
  api_key: string;
  temperature?: number;
}

export interface LLMConfigUpdate {
  base_url?: string;
  model?: string;
  api_key?: string;
  temperature?: number;
  is_active?: boolean;
}

export class LLMConfigApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('auth_token');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

  async getLLMConfigs(): Promise<LLMConfigResponse[]> {
    return this.request<LLMConfigResponse[]>('/llm-configs');
  }

  async getLLMConfig(configId: string): Promise<LLMConfigResponse> {
    return this.request<LLMConfigResponse>(`/llm-configs/${configId}`);
  }

  async createLLMConfig(configData: LLMConfigCreate): Promise<LLMConfigResponse> {
    return this.request<LLMConfigResponse>('/llm-configs', {
      method: 'POST',
      body: JSON.stringify(configData),
    });
  }

  async updateLLMConfig(configId: string, configData: LLMConfigUpdate): Promise<LLMConfigResponse> {
    return this.request<LLMConfigResponse>(`/llm-configs/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(configData),
    });
  }

  async deleteLLMConfig(configId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/llm-configs/${configId}`, {
      method: 'DELETE',
    });
  }
}

export const llmConfigApi = new LLMConfigApiService();