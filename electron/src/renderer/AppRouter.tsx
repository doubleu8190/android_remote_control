import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import ProtectedRoute from './components/ProtectedRoute';

// 会话管理页面组件
const SessionManagementPage = () => {
  const [sessions] = useState([
    { id: '1', name: 'Android Device 1', status: 'connected', lastActive: '2024-01-15 14:30' },
    { id: '2', name: 'Android Device 2', status: 'disconnected', lastActive: '2024-01-14 10:15' },
    { id: '3', name: 'Android Device 3', status: 'connected', lastActive: '2024-01-15 09:45' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">会话管理</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">管理您的Android设备远程控制会话</p>
        </div>
        <button className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建会话
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <div key={session.id} className="card p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{session.name}</h3>
                <div className="flex items-center mt-1">
                  <div className={`w-2 h-2 rounded-full mr-2 ${session.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {session.status === 'connected' ? '已连接' : '未连接'}
                  </span>
                </div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{session.lastActive}</span>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button className="btn-primary flex-1 text-sm py-2">
                {session.status === 'connected' ? '控制设备' : '连接设备'}
              </button>
              <button className="btn-secondary text-sm py-2 px-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 会话详情页面组件
const SessionDetailPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">设备控制面板</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">实时控制Android设备</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary">断开连接</button>
          <button className="btn-primary">刷新画面</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card p-4">
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-gray-400">设备视频流未连接</p>
                <p className="text-sm text-gray-500 mt-1">点击"刷新画面"按钮开始连接</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">设备信息</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">设备名称</label>
                <p className="font-medium text-gray-900 dark:text-white">Android Device 1</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-300">连接状态</label>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="font-medium text-green-600 dark:text-green-400">已连接</span>
                </div>
              </div>
            </div>
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

      {/* 404页面 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;