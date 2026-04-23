import { contextBridge, ipcRenderer } from 'electron';

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用信息
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 打开外部链接
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  
  // 获取系统主题
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  
  // 监听创建新会话事件
  onCreateNewSession: (callback: () => void) => {
    ipcRenderer.on('create-new-session', callback);
    return () => ipcRenderer.removeListener('create-new-session', callback);
  },
  
  // 平台检测
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
  
  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
});

// 扩展Window接口
declare global {
  interface Window {
    electronAPI: {
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