import { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell, nativeTheme } from 'electron';
import { spawn, execSync, exec, ChildProcess } from 'child_process';
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
    resizable: true,
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

  // 窗口移动时通知渲染进程（用于 scrcpy 位置同步）
  mainWindow.on('move', () => {
    mainWindow?.webContents.send('main-window-moved');
  });

  // 窗口大小变化时通知渲染进程
  mainWindow.on('resize', () => {
    mainWindow?.webContents.send('main-window-resized');
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

// ==================== scrcpy 管理 ====================
let scrcpyProcess: ChildProcess | null = null;

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

function getScrcpyPids(): number[] {
  try {
    if (process.platform === 'darwin') {
      const result = execSync(
        `pgrep -f "[s]crcpy.*${mainWindow?.getTitle() ? '' : ''}" || true`,
        { timeout: 3000 }
      ).toString().trim();
      return result ? result.split('\n').map(Number).filter(n => !isNaN(n)) : [];
    }
    if (process.platform === 'linux') {
      const result = execSync(
        `pgrep -x scrcpy || true`,
        { timeout: 3000 }
      ).toString().trim();
      return result ? result.split('\n').map(Number).filter(n => !isNaN(n)) : [];
    }
    if (process.platform === 'win32') {
      const result = execSync(
        `tasklist /FI "IMAGENAME eq scrcpy.exe" /FO CSV /NH || echo ""`,
        { timeout: 3000 }
      ).toString().trim();
      return result ? [0] : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function killScrcpyProcess() {
  if (scrcpyProcess && scrcpyProcess.pid) {
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        execSync(`kill -SIGTERM ${scrcpyProcess.pid} 2>/dev/null || true`, { timeout: 3000 });
      } else {
        execSync(`taskkill /F /PID ${scrcpyProcess.pid} 2>nul || true`, { timeout: 3000 });
      }
    } catch {
      // ignore
    }
    scrcpyProcess = null;
  }

  const remaining = getScrcpyPids();
  for (const pid of remaining) {
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        execSync(`kill -SIGTERM ${pid} 2>/dev/null || true`, { timeout: 2000 });
      } else {
        execSync(`taskkill /F /PID ${pid} 2>nul || true`, { timeout: 2000 });
      }
    } catch {
      // ignore
    }
  }
}

function moveScrcpyWindow(options: ScrcpyMoveOptions) {
  try {
    if (process.platform === 'darwin') {
      exec(
        `osascript -e 'tell application "System Events" to set {position, size} of first window of (first process whose name contains "scrcpy") to {{${options.x}, ${options.y}}, {${options.width}, ${options.height}}}'`,
        { timeout: 2000 }
      );
    } else if (process.platform === 'linux') {
      exec(
        `xdotool search --name "scrcpy" windowmove ${options.x} ${options.y} windowsize ${options.width} ${options.height}`,
        { timeout: 2000 }
      );
    } else if (process.platform === 'win32') {
      exec(
        `powershell -Command "Add-Type @\\\"using System; using System.Runtime.InteropServices; public class Win32 { [DllImport(\\\"user32.dll\\\")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags); } [Win32]::SetWindowPos((Get-Process scrcpy).MainWindowHandle, [IntPtr]::Zero, ${options.x}, ${options.y}, ${options.width}, ${options.height}, 0x0040);\\""`,
        { timeout: 2000 }
      );
    }
  } catch {
    // ignore
  }
}

ipcMain.handle('start-scrcpy', async (_event, options: ScrcpyStartOptions) => {
  if (scrcpyProcess) {
    killScrcpyProcess();
  }

  try {
    const adbResult = execSync(
      `adb connect ${options.deviceIp}:${options.devicePort}`,
      { timeout: 10000 }
    ).toString().toLowerCase();

    if (!adbResult.includes('connected')) {
      return { success: false, error: `ADB 连接设备 ${options.deviceIp}:${options.devicePort} 失败: ${adbResult}` };
    }

    await new Promise(resolve => setTimeout(resolve, 1500));

    const scrcpyArgs = [
      '-s', `${options.deviceIp}:${options.devicePort}`,
      '--window-borderless',
      `--window-x=${options.x}`,
      `--window-y=${options.y}`,
      `--window-width=${options.width}`,
      `--window-height=${options.height}`,
      '--max-fps', '30',
      '--video-bit-rate', '4M',
    ];

    console.log(`[scrcpy] 启动命令: scrcpy ${scrcpyArgs.join(' ')}`);

    scrcpyProcess = spawn('scrcpy', scrcpyArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    scrcpyProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[scrcpy stdout] ${data.toString().trim()}`);
    });

    scrcpyProcess.stderr?.on('data', (data: Buffer) => {
      console.log(`[scrcpy stderr] ${data.toString().trim()}`);
    });

    scrcpyProcess.on('close', (code) => {
      console.log(`[scrcpy] 进程退出，退出码: ${code}`);
      scrcpyProcess = null;
    });

    scrcpyProcess.on('error', (err) => {
      console.error(`[scrcpy] 进程错误:`, err);
      scrcpyProcess = null;
    });

    return { success: true };
  } catch (error) {
    console.error('[scrcpy] 启动失败:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('stop-scrcpy', async () => {
  killScrcpyProcess();
  try {
    execSync('adb disconnect 2>/dev/null || true', { timeout: 3000 });
  } catch {
    // ignore
  }
  return { success: true };
});

ipcMain.handle('move-scrcpy-window', async (_event, options: ScrcpyMoveOptions) => {
  moveScrcpyWindow(options);
  return { success: true };
});

ipcMain.handle('get-scrcpy-status', async () => {
  return {
    running: scrcpyProcess !== null && scrcpyProcess.exitCode === null,
  };
});

// ==================== ADB 投屏管理（替代 scrcpy） ====================
let adbScreencapRunning = false;
let adbScreencapDeviceIp = '';
let adbScreencapDevicePort = 0;

function ensureAdbConnected(ip: string, port: number): boolean {
  try {
    const checkResult = execSync('adb devices', { timeout: 3000 }).toString();
    if (checkResult.includes(`${ip}:${port}\tdevice`)) {
      return true;
    }
    const connectResult = execSync(`adb connect ${ip}:${port}`, { timeout: 10000 }).toString();
    return connectResult.toLowerCase().includes('connected');
  } catch {
    return false;
  }
}

function execPromise(command: string, options: { timeout: number; maxBuffer: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    exec(command, { ...options, encoding: 'buffer' }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout as Buffer);
    });
  });
}

async function adbScreencapLoop(win: BrowserWindow) {
  console.log(`[ADB] 开始投屏循环 ${adbScreencapDeviceIp}:${adbScreencapDevicePort}`);
  while (adbScreencapRunning) {
    try {
      const stdout = await execPromise(
        `adb -s ${adbScreencapDeviceIp}:${adbScreencapDevicePort} exec-out screencap -p`,
        { timeout: 8000, maxBuffer: 10 * 1024 * 1024 }
      );

      if (!adbScreencapRunning) break;

      if (stdout.length > 100 && win && !win.isDestroyed()) {
        win.webContents.send('adb-screencap-frame', stdout);
      }
    } catch (e) {
      console.error(`[ADB] screencap 异常:`, e);
    }

    if (adbScreencapRunning) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  console.log(`[ADB] 投屏循环结束 ${adbScreencapDeviceIp}:${adbScreencapDevicePort}`);
}

ipcMain.handle('adb-check-server', async () => {
  try {
    execSync('adb start-server', { timeout: 5000 });
    console.log('[ADB] 服务已启动');
    return { success: true };
  } catch (error) {
    console.error('[ADB] 启动服务失败:', error);
    return { success: false, error: 'ADB 服务启动失败，请确保 adb 已安装并添加到系统 PATH' };
  }
});

ipcMain.handle('adb-connect-device', async (_event, options: { deviceIp: string; devicePort: number }) => {
  const connected = ensureAdbConnected(options.deviceIp, options.devicePort);
  if (connected) {
    return { success: true };
  }
  return { success: false, error: `ADB 连接设备 ${options.deviceIp}:${options.devicePort} 失败` };
});

ipcMain.handle('adb-screencap-start', async (_event, options: { deviceIp: string; devicePort: number }) => {
  adbScreencapRunning = false;

  adbScreencapDeviceIp = options.deviceIp;
  adbScreencapDevicePort = options.devicePort;

  if (!ensureAdbConnected(options.deviceIp, options.devicePort)) {
    console.error(`[ADB] screencap-start 连接失败 ${options.deviceIp}:${options.devicePort}`);
    return { success: false, error: `ADB 连接设备 ${options.deviceIp}:${options.devicePort} 失败` };
  }

  const win = mainWindow;
  if (!win) {
    console.error('[ADB] screencap-start 主窗口不可用');
    return { success: false, error: '主窗口不可用' };
  }

  adbScreencapRunning = true;
  adbScreencapLoop(win);

  return { success: true };
});

ipcMain.handle('adb-screencap-stop', async () => {
  adbScreencapRunning = false;
  return { success: true };
});

ipcMain.handle('adb-screencap-status', async () => {
  return { running: adbScreencapRunning };
});

app.on('before-quit', () => {
  killScrcpyProcess();
  adbScreencapRunning = false;
});