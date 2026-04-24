const API_BASE_URL = 'http://localhost:8080/api';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterRequest {
  username: string;
  email?: string;
  full_name?: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  created_at: string;
  updated_at: string;
}

export class AuthApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  async login(username: string, password: string): Promise<{ success: boolean; data?: LoginResponse; error?: string }> {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '登录失败');
      }

      const data: LoginResponse = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误，请稍后重试',
      };
    }
  }

  async register(userData: RegisterRequest): Promise<{ success: boolean; data?: UserResponse; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || '注册失败');
      }

      const data: UserResponse = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误，请稍后重试',
      };
    }
  }

  async getCurrentUser(token: string): Promise<{ success: boolean; data?: UserResponse; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取用户信息失败');
      }

      const data: UserResponse = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Get current user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误，请稍后重试',
      };
    }
  }
}

export const authApi = new AuthApiService();