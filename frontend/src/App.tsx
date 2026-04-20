import { useEffect } from 'react';
import { BrowserRouter, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppRouter from './AppRouter';
import './index.css';

// Header 组件
const Header = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const toggleTheme = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 shrink-0">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* 左侧标题区域 */}
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <Link to="/sessions" className="flex items-center">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                AI
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">AI Agent Chat Interface</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">Powered by LangChain Engine</p>
              </div>
            </Link>
          </div>
        </div>

        {/* 右侧用户区域 */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email || 'AI Chat User'}
              </p>
            </div>
          )}
          <button
            id="theme-toggle"
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
          {user && (
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出登录
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
          <Header />
          <main className="flex-1 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 min-h-0">
              <AppRouter />
            </div>
          </main>
          <footer className="bg-white border-t border-gray-200 dark:bg-gray-800 dark:border-gray-700 shrink-0">
            <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              <p>© 2026 AI Agent Platform. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;