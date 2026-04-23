import { useEffect, useState } from 'react';
import { HashRouter as Router, Link } from 'react-router-dom';
import AppRouter from './AppRouter';
import './index.css';

// 扩展Window接口以包含electronAPI
declare global {
  interface Window {
    electronAPI?: {
      getAppInfo: () => Promise<{
        version: string;
        name: string;
        platform: string;
      }>;
      openExternalUrl: (url: string) => Promise<void>;
      getSystemTheme: () => Promise<'dark' | 'light'>;
      onCreateNewSession: (callback: () => void) => () => void;
      isMac: boolean;
      isWindows: boolean;
      isLinux: boolean;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

// Header 组件
const Header = () => {
  const [appInfo, setAppInfo] = useState<{ name: string; version: string; platform: string } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

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

  const toggleTheme = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow();
      setIsMaximized(!isMaximized);
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 shrink-0">
      <div className="flex items-center justify-between px-4 py-2">
        {/* 左侧标题区域 */}
        <div className="flex-1 flex items-center gap-4">
          <Link to="/sessions" className="flex items-center">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              AI
            </div>
            <div className="ml-3">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Android Remote Control</h1>
              {appInfo && (
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  v{appInfo.version} • {appInfo.platform}
                </p>
              )}
            </div>
          </Link>
        </div>

        {/* 窗口控制按钮区域 */}
        <div className="flex items-center gap-2">
          {/* 主题切换按钮 */}
          <button
            id="theme-toggle"
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>

          {/* 窗口控制按钮 - 仅非macOS平台显示 */}
          {window.electronAPI?.isWindows || window.electronAPI?.isLinux ? (
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={handleMinimize}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label="Minimize window"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={handleMaximize}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                aria-label={isMaximized ? "Restore window" : "Maximize window"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  {isMaximized ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5v4m0-4h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  )}
                </svg>
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 hover:bg-red-500 hover:text-white rounded transition-colors"
                aria-label="Close window"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

function App() {
  useEffect(() => {
    // 初始化主题
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);

    // 监听Electron菜单事件
    if (window.electronAPI) {
      const removeListener = window.electronAPI.onCreateNewSession(() => {
        // 这里可以触发创建新会话的逻辑
        console.log('Create new session from menu');
      });

      return () => {
        mediaQuery.removeEventListener('change', handleThemeChange);
        removeListener();
      };
    }

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <Header />
        <main className="flex-1 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 min-h-0">
            <AppRouter />
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;