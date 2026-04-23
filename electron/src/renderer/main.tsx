import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 初始化主题
const initializeTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// 初始化应用信息
const initializeAppInfo = async () => {
  if (window.electronAPI) {
    try {
      const appInfo = await window.electronAPI.getAppInfo();
      console.log('App Info:', appInfo);
    } catch (error) {
      console.error('Failed to get app info:', error);
    }
  }
};

// 初始化
initializeTheme();
initializeAppInfo();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);