import { contextBridge, ipcRenderer } from 'electron';

// scrcpy IPC 类型
interface ScrcpyStartOptions {
  deviceIp: string;
  devicePort: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScrcpyMoveOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScrcpyResult {
  success: boolean;
  error?: string;
}

interface ScrcpyStatus {
  running: boolean;
}

// adb 投屏类型
interface AdbScreencapStartOptions {
  deviceIp: string;
  devicePort: number;
}

interface AdbScreencapResult {
  success: boolean;
  error?: string;
}

interface AdbScreencapStatus {
  running: boolean;
}

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

  // scrcpy 控制（保留但标记为弃用）
  startScrcpy: (options: ScrcpyStartOptions) => ipcRenderer.invoke('start-scrcpy', options) as Promise<ScrcpyResult>,
  stopScrcpy: () => ipcRenderer.invoke('stop-scrcpy') as Promise<ScrcpyResult>,
  moveScrcpyWindow: (options: ScrcpyMoveOptions) => ipcRenderer.invoke('move-scrcpy-window', options) as Promise<ScrcpyResult>,
  getScrcpyStatus: () => ipcRenderer.invoke('get-scrcpy-status') as Promise<ScrcpyStatus>,

  // ADB 投屏控制
  startAdbScreencap: (options: AdbScreencapStartOptions) =>
    ipcRenderer.invoke('adb-screencap-start', options) as Promise<AdbScreencapResult>,
  stopAdbScreencap: () =>
    ipcRenderer.invoke('adb-screencap-stop') as Promise<AdbScreencapResult>,
  getAdbScreencapStatus: () =>
    ipcRenderer.invoke('adb-screencap-status') as Promise<AdbScreencapStatus>,
  onAdbScreencapFrame: (callback: (data: ArrayBuffer) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, buffer: Buffer) => {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      callback(ab as ArrayBuffer);
    };
    ipcRenderer.on('adb-screencap-frame', handler);
    return () => ipcRenderer.removeListener('adb-screencap-frame', handler);
  },

  // ADB 服务检测与启动
  checkAdbServer: () =>
    ipcRenderer.invoke('adb-check-server') as Promise<AdbScreencapResult>,

  // ADB 设备连接
  adbConnectDevice: (options: AdbScreencapStartOptions) =>
    ipcRenderer.invoke('adb-connect-device', options) as Promise<AdbScreencapResult>,

  // 监听主窗口事件（用于 scrcpy 位置同步）
  onMainWindowMoved: (callback: () => void) => {
    ipcRenderer.on('main-window-moved', callback);
    return () => ipcRenderer.removeListener('main-window-moved', callback);
  },
  onMainWindowResized: (callback: () => void) => {
    ipcRenderer.on('main-window-resized', callback);
    return () => ipcRenderer.removeListener('main-window-resized', callback);
  },
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

      startScrcpy: (options: ScrcpyStartOptions) => Promise<ScrcpyResult>;
      stopScrcpy: () => Promise<ScrcpyResult>;
      moveScrcpyWindow: (options: ScrcpyMoveOptions) => Promise<ScrcpyResult>;
      getScrcpyStatus: () => Promise<ScrcpyStatus>;

      startAdbScreencap: (options: AdbScreencapStartOptions) => Promise<AdbScreencapResult>;
      stopAdbScreencap: () => Promise<AdbScreencapResult>;
      getAdbScreencapStatus: () => Promise<AdbScreencapStatus>;
      onAdbScreencapFrame: (callback: (data: ArrayBuffer) => void) => () => void;

      checkAdbServer: () => Promise<AdbScreencapResult>;
      adbConnectDevice: (options: AdbScreencapStartOptions) => Promise<AdbScreencapResult>;

      onMainWindowMoved: (callback: () => void) => () => void;
      onMainWindowResized: (callback: () => void) => () => void;
    };
  }
}
