/**
 * 平台适配工具
 * 确保应用在不同操作系统上具有一致的展示效果
 */

// 平台类型
export type Platform = 'darwin' | 'win32' | 'linux';

// 获取当前平台
export const getPlatform = (): Platform => {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform as Platform;
  }
  
  // 在渲染进程中通过 electronAPI 获取
  if (typeof window !== 'undefined' && window.electronAPI) {
    if (window.electronAPI.isMac) return 'darwin';
    if (window.electronAPI.isWindows) return 'win32';
    if (window.electronAPI.isLinux) return 'linux';
  }
  
  // 默认返回当前操作系统
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'darwin';
  if (userAgent.includes('win')) return 'win32';
  return 'linux';
};

// 平台特定样式类
export const getPlatformClasses = () => {
  const platform = getPlatform();
  
  const baseClasses = {
    // 通用样式
    windowFrame: '',
    titleBar: '',
    button: '',
    scrollbar: '',
  };
  
  switch (platform) {
    case 'darwin':
      return {
        ...baseClasses,
        windowFrame: 'rounded-t-lg',
        titleBar: 'h-8',
        button: 'rounded-full',
        scrollbar: 'scrollbar-thin',
      };
      
    case 'win32':
      return {
        ...baseClasses,
        windowFrame: 'rounded-none',
        titleBar: 'h-10',
        button: 'rounded-md',
        scrollbar: 'scrollbar-standard',
      };
      
    case 'linux':
      return {
        ...baseClasses,
        windowFrame: 'rounded-md',
        titleBar: 'h-9',
        button: 'rounded-lg',
        scrollbar: 'scrollbar-thin',
      };
  }
};

// 平台特定配置
export const getPlatformConfig = () => {
  const platform = getPlatform();
  
  const baseConfig = {
    // 通用配置
    titleBarHeight: 40,
    minWindowWidth: 800,
    minWindowHeight: 600,
    defaultWindowWidth: 1200,
    defaultWindowHeight: 800,
    animationDuration: 200,
    shadowIntensity: 'md',
  };
  
  switch (platform) {
    case 'darwin':
      return {
        ...baseConfig,
        titleBarHeight: 28,
        shadowIntensity: 'lg',
        trafficLights: true,
      };
      
    case 'win32':
      return {
        ...baseConfig,
        titleBarHeight: 40,
        shadowIntensity: 'md',
        trafficLights: false,
      };
      
    case 'linux':
      return {
        ...baseConfig,
        titleBarHeight: 36,
        shadowIntensity: 'sm',
        trafficLights: false,
      };
  }
};

// 字体配置
export const getFontConfig = () => {
  const platform = getPlatform();
  
  const baseFonts = {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  };
  
  switch (platform) {
    case 'darwin':
      return {
        ...baseFonts,
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Menlo', 'Monaco', 'JetBrains Mono', 'monospace'],
      };
      
    case 'win32':
      return {
        ...baseFonts,
        sans: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Code', 'JetBrains Mono', 'monospace'],
      };
      
    case 'linux':
      return {
        ...baseFonts,
        sans: ['Ubuntu', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      };
  }
};

// 快捷键映射
export const getShortcutConfig = () => {
  const platform = getPlatform();
  
  const baseShortcuts = {
    newSession: 'Ctrl+N',
    refresh: 'F5',
    screenshot: 'Ctrl+S',
    toggleDevTools: 'Ctrl+Shift+I',
    toggleFullscreen: 'F11',
    minimize: 'Ctrl+M',
    close: 'Ctrl+W',
    quit: 'Ctrl+Q',
  };
  
  if (platform === 'darwin') {
    return {
      ...baseShortcuts,
      newSession: 'Cmd+N',
      screenshot: 'Cmd+S',
      toggleDevTools: 'Cmd+Alt+I',
      minimize: 'Cmd+M',
      close: 'Cmd+W',
      quit: 'Cmd+Q',
    };
  }
  
  return baseShortcuts;
};

// 系统托盘配置
export const getTrayConfig = () => {
  const platform = getPlatform();
  
  return {
    iconSize: platform === 'darwin' ? 16 : 32,
    showTooltip: true,
    contextMenu: true,
  };
};

// 文件路径处理
export const getPathConfig = () => {
  const platform = getPlatform();
  
  const basePaths = {
    configDir: '.android-remote-control',
    logsDir: 'logs',
    screenshotsDir: 'screenshots',
  };
  
  let homeDir = '';
  
  if (platform === 'win32') {
    homeDir = process.env.USERPROFILE || process.env.HOMEPATH || '';
    return {
      ...basePaths,
      configPath: `${homeDir}\\AppData\\Roaming\\${basePaths.configDir}`,
      separator: '\\',
    };
  }
  
  homeDir = process.env.HOME || '';
  return {
    ...basePaths,
    configPath: `${homeDir}/.config/${basePaths.configDir}`,
    separator: '/',
  };
};

// 主题适配
export const getThemeConfig = () => {
  const platform = getPlatform();
  
  return {
    // 所有平台使用相同的主题配置
    colors: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
    },
    // 平台特定的细微调整
    adjustments: {
      darwin: {
        blurEffect: true,
        transparency: 0.95,
      },
      win32: {
        blurEffect: false,
        transparency: 1,
      },
      linux: {
        blurEffect: false,
        transparency: 1,
      },
    }[platform],
  };
};

// 导出平台工具函数
export const platformUtils = {
  isMac: () => getPlatform() === 'darwin',
  isWindows: () => getPlatform() === 'win32',
  isLinux: () => getPlatform() === 'linux',
  
  // 获取平台友好的显示名称
  getDisplayName: () => {
    const platform = getPlatform();
    switch (platform) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      default: return 'Unknown';
    }
  },
  
  // 获取平台图标
  getPlatformIcon: () => {
    const platform = getPlatform();
    switch (platform) {
      case 'darwin': return '🍎';
      case 'win32': return '🪟';
      case 'linux': return '🐧';
      default: return '💻';
    }
  },
  
  // 平台特定的用户代理信息
  getUserAgentInfo: () => {
    return {
      platform: getPlatform(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  },
};