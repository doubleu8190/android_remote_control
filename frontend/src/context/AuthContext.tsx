import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserInfo, StoredCredentials } from '../types/auth';
import { chatApiService } from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  rememberMe: boolean;
  login: (username: string, password: string, rememberMe: boolean) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setRememberMe: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// 存储凭证的键名
const STORAGE_KEY = 'ai_agent_auth_credentials';
const TOKEN_KEY = 'auth_token';

// 计算过期时间（7天后）
const calculateExpiry = () => Date.now() + 7 * 24 * 60 * 60 * 1000;

// 检查凭证是否过期
const isExpired = (expiry: number) => Date.now() > expiry;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMeState] = useState(true);

  // 从本地存储加载凭证
  const loadCredentials = useCallback((): StoredCredentials | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const credentials: StoredCredentials = JSON.parse(stored);
      
      // 检查是否过期
      if (isExpired(credentials.expiry)) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }

      return credentials;
    } catch (error) {
      console.error('Error loading credentials:', error);
      return null;
    }
  }, []);

  // 保存凭证到本地存储
  const saveCredentials = useCallback((token: string, userInfo: UserInfo, remember: boolean) => {
    const credentials: StoredCredentials = {
      token,
      user: userInfo,
      expiry: calculateExpiry(),
      rememberMe: remember,
    };

    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
    }
    localStorage.setItem(TOKEN_KEY, token);
  }, []);

  // 清除凭证
  const clearCredentials = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  // 初始化：尝试自动登录
  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true);
        
        // 检查是否有存储的凭证
        const credentials = loadCredentials();
        
        if (credentials) {
          // 有存储的凭证，设置token
          localStorage.setItem(TOKEN_KEY, credentials.token);
          
          // 验证token有效性
          const result = await chatApiService.getCurrentUser();
          
          if (result.success && result.data) {
            setIsAuthenticated(true);
            setUser(result.data);
            setRememberMeState(credentials.rememberMe);
            console.log('Auto-login successful');
          } else {
            // token无效，清除存储
            clearCredentials();
            setIsAuthenticated(false);
            setUser(null);
          }
        } else {
          // 检查是否有token但没有存储的凭证（非记住我模式）
          const token = localStorage.getItem(TOKEN_KEY);
          if (token) {
            // 验证token有效性
            const result = await chatApiService.getCurrentUser();
            
            if (result.success && result.data) {
              setIsAuthenticated(true);
              setUser(result.data);
              console.log('Session login successful');
            } else {
              // token无效，清除存储
              clearCredentials();
              setIsAuthenticated(false);
              setUser(null);
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearCredentials();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [loadCredentials, clearCredentials]);

  const login = useCallback(async (username: string, password: string, remember: boolean): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      console.log('Attempting login...');
      const result = await chatApiService.login(username, password);
      console.log('Login result:', result);

      if (result.success && result.data) {
        const { access_token } = result.data;
        console.log('Login successful, token received:', access_token ? 'yes' : 'no');

        // 先保存token到本地存储，这样getCurrentUser可以读取
        localStorage.setItem(TOKEN_KEY, access_token);

        // 获取用户信息
        console.log('Fetching user info...');
        const userResult = await chatApiService.getCurrentUser();
        console.log('User info result:', userResult);

        if (userResult.success && userResult.data) {
          const userInfo = userResult.data;
          console.log('User info fetched:', userInfo);

          // 保存完整凭证
          saveCredentials(access_token, userInfo, remember);

          // 更新状态
          setIsAuthenticated(true);
          setUser(userInfo);
          setRememberMeState(remember);
          console.log('Auth state updated, isAuthenticated should be true now');

          return true;
        } else {
          console.error('Failed to get user info:', userResult.error);
          setError('Failed to get user information');
          // 清理已保存的token
          localStorage.removeItem(TOKEN_KEY);
          return false;
        }
      } else {
        console.error('Login failed:', result.error);
        setError(result.error || 'Login failed');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [saveCredentials]);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      
      // 调用登出API
      await chatApiService.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // 清除本地存储
      clearCredentials();
      
      // 更新状态
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
    }
  }, [clearCredentials]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const setRememberMe = useCallback((value: boolean) => {
    setRememberMeState(value);
  }, []);

  const value = {
    isAuthenticated,
    user,
    loading,
    error,
    rememberMe,
    login,
    logout,
    clearError,
    setRememberMe,
  };

  // 显示加载状态
  if (loading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Initializing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};