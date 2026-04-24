import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, nativeTheme } from 'electron';
import path from 'path';

// 获取当前目录路径
const appDir = path.resolve();

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(appDir, 'dist/main/preload.js'),
      sandbox: false, // 禁用sandbox以解决macOS上的权限问题
    },
    icon: path.join(appDir, 'public/icon.svg'),
  });

  // 加载渲染进程
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境加载构建后的文件
    const rendererPath = path.join(appDir, 'dist/renderer/index.html');
    console.log('Loading renderer from:', rendererPath);
    mainWindow?.loadFile(rendererPath).catch(err => {
      console.error('Failed to load renderer:', err);
      // 尝试备用路径
      const altPath = path.join(appDir, 'src/renderer/index.html');
      console.log('Trying alternative path:', altPath);
      mainWindow?.loadFile(altPath);
    });
  }

  // 窗口准备就绪后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 处理窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接点击
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 捕获渲染进程的控制台日志
  mainWindow.webContents.on('console-message', (_event, level: number, message: string, line: number, sourceId: string) => {
    const timestamp = new Date().toISOString();
    const levelMap: Record<number, string> = {
      0: 'LOG',
      1: 'WARNING', 
      2: 'ERROR',
      3: 'DEBUG'
    };
    const logLevel = levelMap[level] || 'UNKNOWN';
    console.log(`[RENDERER] [${timestamp}] [${logLevel}] ${message} (${sourceId}:${line})`);
  });

  // 捕获渲染进程的未捕获异常
  mainWindow.webContents.on('unresponsive', () => {
    console.error('[RENDERER] 渲染进程无响应');
  });
};

// 创建系统托盘
const createTray = () => {
  const iconPath = path.join(appDir, 'public/icon.svg');
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开应用',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Android Remote Control');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
};

// 创建应用菜单
const createMenu = () => {
  const isMac = process.platform === 'darwin';
  
  // 使用Electron的Menu.buildFromTemplate创建菜单
  const template = [
    // macOS应用菜单
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    
    // 文件菜单
    {
      label: '文件',
      submenu: [
        {
          label: '新建会话',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('create-new-session');
          }
        },
        { type: 'separator' as const },
        {
          label: '关闭窗口',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            mainWindow?.close();
          }
        }
      ]
    },
    
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: '语音',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },
    
    // 视图菜单
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    
    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [
          { role: 'close' as const }
        ])
      ]
    },
    
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            // 打开关于页面
            mainWindow?.webContents.send('open-about');
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();
  createTray();
  createMenu();

  // macOS 特殊处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 通信处理
ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform,
  };
});

ipcMain.handle('open-external-url', (_event, url: string) => {
  shell.openExternal(url);
});

// 窗口控制
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  mainWindow?.close();
});

// 处理深色模式
ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});