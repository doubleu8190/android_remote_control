import { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import ProfilePage from './components/ProfilePage';
import LLMManagementPage from './components/LLMManagementPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdbScreenCastElectron from './components/AdbScreenCastElectron';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';

import { sessionApi, SessionResponse, MessageResponse } from './services/sessionApi';
import { llmConfigApi } from './services/llmConfigApi';

// 会话管理页面组件
const SessionManagementPage = () => {
  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    device_ip: '',
    device_port: 5555,
    llm_config_id: '',
  });
  const [llmConfigs, setLLMConfigs] = useState<any[]>([]);
  const [loadingLLMConfigs, setLoadingLLMConfigs] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [connectingSession, setConnectingSession] = useState<string | null>(null);
  const navigate = useNavigate();

  // 获取会话列表
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await sessionApi.getSessions();
        setSessions(data);
      } catch (err) {
        console.error('获取会话列表失败:', err);
        setError('获取会话列表失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // 加载LLM配置列表
  const loadLLMConfigs = async () => {
    setLoadingLLMConfigs(true);
    try {
      const configs = await llmConfigApi.getLLMConfigs();
      setLLMConfigs(configs);
    } catch (err) {
      console.error('加载LLM配置失败:', err);
      setLLMConfigs([]);
    } finally {
      setLoadingLLMConfigs(false);
    }
  };

  // 处理新建会话
  const handleCreateSession = async () => {
    if (!newSession.device_ip) {
      setModalError('请输入设备IP');
      return;
    }

    try {
      setModalError(null);
      await sessionApi.createSession({
        title: newSession.title || undefined,
        device_ip: newSession.device_ip,
        device_port: newSession.device_port,
        llm_config_id: newSession.llm_config_id,
      });
      // 刷新会话列表
      const data = await sessionApi.getSessions();
      setSessions(data);
      setShowCreateModal(false);
      setNewSession({ title: '', device_ip: '', device_port: 5555, llm_config_id: '' });
    } catch (err) {
      console.error('创建会话失败:', err);
      setModalError('创建会话失败，请稍后重试');
    }
  };

  const [connectError, setConnectError] = useState<string | null>(null);

  // 处理连接会话
  const handleConnectSession = async (session: SessionResponse) => {
    try {
      setConnectingSession(session.id);
      setConnectError(null);
      console.log('开始连接设备:', session.id);

      if (window.electronAPI) {
        const result = await window.electronAPI.adbConnectDevice({
          deviceIp: session.device_ip,
          devicePort: session.device_port,
        });
        if (!result.success) {
          throw new Error(result.error || 'ADB 连接失败');
        }
        console.log('ADB 直连设备成功');
      } else {
        await sessionApi.connectSession({
          session_id: session.id,
        });
        console.log('连接设备成功');
      }

      console.log('导航到会话详情:', `/sessions/${session.id}`);
      navigate(`/sessions/${session.id}`);
    } catch (err) {
      console.error('连接设备失败:', err);
      setConnectError('连接设备失败，请检查设备IP和端口是否正确');
    } finally {
      setConnectingSession(null);
    }
  };

  // 处理删除会话
  const handleDeleteSession = async (sessionId: string) => {
    if (confirm('确定要删除这个会话吗？')) {
      try {
        await sessionApi.deleteSession(sessionId);
        // 刷新会话列表
        const data = await sessionApi.getSessions();
        setSessions(data);
      } catch (err) {
        console.error('删除会话失败:', err);
        // 可以在这里添加错误提示
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">会话管理</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">管理您的Android设备远程控制会话</p>
        </div>
        <button 
          className="btn-primary"
          onClick={async () => {
            await loadLLMConfigs();
            setShowCreateModal(true);
          }}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建会话
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">错误: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {connectError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <strong className="font-bold">连接错误: </strong>
          <span className="block sm:inline">{connectError}</span>
          <button 
            className="mt-2 text-sm text-red-600 hover:underline"
            onClick={() => setConnectError(null)}
          >
            关闭
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">暂无会话</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-300">点击"新建会话"按钮创建您的第一个会话</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div key={session.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{session.title}</h3>
                  <div className="flex items-center mt-1">
                    <div className="w-2 h-2 rounded-full mr-2 bg-gray-400"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {session.device_ip}:{session.device_port}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button 
                  className="btn-primary flex-1 text-sm py-2"
                  onClick={() => handleConnectSession(session)}
                  disabled={connectingSession === session.id}
                >
                  {connectingSession === session.id ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      连接中...
                    </span>
                  ) : (
                    '连接'
                  )}
                </button>
                <button 
                  className="btn-secondary text-sm py-2 px-3"
                  onClick={() => handleDeleteSession(session.id)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新建会话模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">新建会话</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {modalError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4" role="alert">
                {modalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  会话名称（可选）
                </label>
                <input
                  type="text"
                  value={newSession.title}
                  onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="输入会话名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  设备IP <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSession.device_ip}
                  onChange={(e) => setNewSession({ ...newSession, device_ip: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="例如: 192.168.1.100"
                />
              </div>

              <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                设备端口
              </label>
              <input
                type="number"
                value={newSession.device_port}
                onChange={(e) => setNewSession({ ...newSession, device_port: parseInt(e.target.value) || 5555 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                min="1"
                max="65535"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                LLM
              </label>
              {loadingLLMConfigs ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-gray-500 dark:text-gray-400">加载中...</span>
                </div>
              ) : llmConfigs.length === 0 ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  暂无LLM配置，请先在LLM管理页面添加
                </div>
              ) : (
                <select
                  value={newSession.llm_config_id}
                  onChange={(e) => setNewSession({ ...newSession, llm_config_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">选择LLM模型</option>
                  {llmConfigs.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.model} - {config.base_url}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              >
                取消
              </button>
              <button
                onClick={handleCreateSession}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 会话详情页面组件
const SessionDetailPage = () => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadSessionDetails = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoadingMessages(true);
      setMessageError(null);
      const data = await sessionApi.getSession(sessionId);
      setSession(data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('加载会话详情失败:', err);
      setMessageError('加载消息记录失败，请稍后重试');
    } finally {
      setLoadingMessages(false);
    }
  }, [sessionId]);

  const handleSendMessage = async (content: string) => {
    if (!sessionId || sendingMessage) return;
    try {
      setSendingMessage(true);
      const token = localStorage.getItem('auth_token');
      const response = await fetch('http://localhost:8080/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, message: content, stream: false }),
      });

      if (!response.ok) throw new Error('发送消息失败');

      const result = await response.json();
      const userMsg: MessageResponse = {
        id: `user-${Date.now()}`,
        content,
        role: 'user',
        status: 'sent',
        timestamp: new Date().toISOString(),
        session_id: sessionId,
      };
      const aiMsg: MessageResponse = {
        id: result.messageId || `ai-${Date.now()}`,
        content: result.content || '',
        role: result.role || 'assistant',
        status: 'delivered',
        timestamp: result.timestamp || new Date().toISOString(),
        session_id: sessionId,
      };
      setMessages(prev => [...prev, userMsg, aiMsg]);
    } catch (err) {
      console.error('发送消息失败:', err);
      setMessageError('发送消息失败，请稍后重试');
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    loadSessionDetails();
  }, [loadSessionDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sessions')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {session?.title || '设备控制面板'}
            </h1>
            {session && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {session.device_ip}:{session.device_port}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 min-w-0">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">聊天记录</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MessageList messages={messages} isLoading={loadingMessages} />
            <div ref={messagesEndRef} />
          </div>
          {messageError && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{messageError}</p>
              <button onClick={loadSessionDetails} className="text-sm text-red-600 hover:underline">
                重试
              </button>
            </div>
          )}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <MessageInput onSendMessage={handleSendMessage} disabled={sendingMessage} />
          </div>
        </div>

        <div className="w-96 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">设备投屏</h2>
          </div>
          <div className="flex-1 p-3 min-h-0">
            {session ? (
              <AdbScreenCastElectron
                deviceIp={session.device_ip}
                devicePort={session.device_port}
                autoConnect={true}
                className="w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                加载设备信息中...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 设置页面组件
const SettingsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设置</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">配置应用程序偏好</p>
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">常规设置</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900 dark:text-white">启动时自动连接</label>
              <p className="text-sm text-gray-600 dark:text-gray-300">应用程序启动时自动连接到上次使用的设备</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// 关于页面组件
const AboutPage = () => {
  const [appInfo, setAppInfo] = useState<{ name: string; version: string; platform: string } | null>(null);

  useEffect(() => {
    const loadAppInfo = async () => {
      if (window.electronAPI) {
        try {
          const info = await window.electronAPI.getAppInfo();
          setAppInfo(info);
        } catch (error) {
          console.error('Failed to load app info:', error);
        }
      }
    };

    loadAppInfo();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">关于</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">应用程序信息和版本</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-2xl">
            AI
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Android Remote Control</h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1">专业的Android设备远程控制桌面应用程序</p>
            
            {appInfo && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300 w-24">版本:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{appInfo.version}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-300 w-24">平台:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{appInfo.platform}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AppRouter = () => {
  return (
    <Routes>
      {/* 默认路径重定向到登录页面 */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 登录页面 - 已认证用户无法访问 */}
      <Route
        path="/login"
        element={
          <ProtectedRoute requireAuth={false}>
            <LoginPage />
          </ProtectedRoute>
        }
      />

      {/* 注册页面 - 已认证用户无法访问 */}
      <Route
        path="/register"
        element={
          <ProtectedRoute requireAuth={false}>
            <RegistrationPage />
          </ProtectedRoute>
        }
      />

      {/* 会话管理页面 - 需要认证 */}
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <SessionManagementPage />
          </ProtectedRoute>
        }
      />

      {/* 会话详情页面 - 需要认证 */}
      <Route
        path="/sessions/:id"
        element={
          <ProtectedRoute>
            <SessionDetailPage />
          </ProtectedRoute>
        }
      />

      {/* 设置页面 - 需要认证 */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* 关于页面 - 需要认证 */}
      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <AboutPage />
          </ProtectedRoute>
        }
      />

      {/* 用户信息页面 - 需要认证 */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* LLM管理页面 - 需要认证 */}
      <Route
        path="/llm"
        element={
          <ProtectedRoute>
            <LLMManagementPage />
          </ProtectedRoute>
        }
      />

      {/* 404页面 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;