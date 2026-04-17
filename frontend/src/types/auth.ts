export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  id: string;
  username: string;
  email?: string;
  full_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: UserInfo | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  rememberMe: boolean;
}

export interface StoredCredentials {
  token: string;
  user: UserInfo;
  expiry: number; // 过期时间戳（毫秒）
  rememberMe: boolean;
}