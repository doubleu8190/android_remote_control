import { useState, useEffect, useRef, useCallback } from 'react';

interface ScrcpyWindowProps {
  deviceIp: string;
  devicePort: number;
  autoConnect?: boolean;
  className?: string;
}

type ConnectStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  return debounced as T;
}

const ScrcpyWindow = ({ deviceIp, devicePort, autoConnect = false, className = '' }: ScrcpyWindowProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ConnectStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<ConnectStatus>('disconnected');
  const containerRectRef = useRef<DOMRect | null>(null);

  const getScreenRect = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    containerRectRef.current = rect;
    const titleBarHeight = (window.outerHeight - window.innerHeight);

    return {
      x: Math.round(window.screenX + rect.left),
      y: Math.round(window.screenY + titleBarHeight + rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  }, []);

  const syncWindowPosition = useCallback(() => {
    if (statusRef.current !== 'connected') return;
    const rect = getScreenRect();
    if (rect && window.electronAPI) {
      window.electronAPI.moveScrcpyWindow(rect);
    }
  }, [getScreenRect]);

  const debouncedSync = useCallback(
    debounce(() => syncWindowPosition(), 50),
    [syncWindowPosition]
  );

  const handleStart = useCallback(async () => {
    if (!window.electronAPI) {
      setError('electronAPI 不可用，请确保在 Electron 环境中运行');
      setStatus('error');
      statusRef.current = 'error';
      return;
    }

    setStatus('connecting');
    setError(null);
    statusRef.current = 'connecting';

    const rect = getScreenRect();
    if (!rect) {
      setError('无法获取容器位置');
      setStatus('error');
      statusRef.current = 'error';
      return;
    }

    try {
      const result = await window.electronAPI.startScrcpy({
        deviceIp,
        devicePort,
        ...rect,
      });

      if (result.success) {
        setStatus('connected');
        statusRef.current = 'connected';
      } else {
        setError(result.error || '启动 scrcpy 失败');
        setStatus('error');
        statusRef.current = 'error';
      }
    } catch (err) {
      setError(String(err));
      setStatus('error');
      statusRef.current = 'error';
    }
  }, [deviceIp, devicePort, getScreenRect]);

  const handleStop = useCallback(async () => {
    if (window.electronAPI) {
      await window.electronAPI.stopScrcpy();
    }

    setStatus('disconnected');
    setError(null);
    statusRef.current = 'disconnected';
  }, []);

  useEffect(() => {
    if (autoConnect) {
      handleStart();
    }
    return () => {
      handleStop();
    };
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;

    const unsubs: (() => void)[] = [];

    if (window.electronAPI) {
      unsubs.push(
        window.electronAPI.onMainWindowMoved(debouncedSync),
        window.electronAPI.onMainWindowResized(debouncedSync),
      );
    }

    const handleWindowResize = () => debouncedSync();
    window.addEventListener('resize', handleWindowResize);
    unsubs.push(() => window.removeEventListener('resize', handleWindowResize));

    let observer: ResizeObserver | null = null;
    let parentObserver: ResizeObserver | null = null;
    if (containerRef.current) {
      observer = new ResizeObserver(debouncedSync);
      observer.observe(containerRef.current);
      if (containerRef.current.parentElement) {
        parentObserver = new ResizeObserver(debouncedSync);
        parentObserver.observe(containerRef.current.parentElement);
      }
    }
    unsubs.push(() => { observer?.disconnect(); parentObserver?.disconnect(); });

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [status, debouncedSync]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-lg bg-gray-900 ${className}`}>
      {status === 'disconnected' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm mb-3">设备投屏未连接</p>
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            启动投屏
          </button>
        </div>
      )}

      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3" />
          <p className="text-sm">正在启动 scrcpy 投屏...</p>
          <p className="text-xs text-gray-500 mt-1">{deviceIp}:{devicePort}</p>
          <button
            onClick={handleStop}
            className="mt-4 px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {status === 'connected' && (
        <>
          <div className="absolute top-2 right-2 z-10 flex gap-2">
            <span className="px-2 py-1 bg-green-600/80 text-white text-xs rounded backdrop-blur-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-pulse" />
              投屏中
            </span>
            <button
              onClick={handleStop}
              className="px-2 py-1 bg-red-600/80 text-white text-xs rounded hover:bg-red-700 backdrop-blur-sm transition-colors"
            >
              断开
            </button>
          </div>
          <div className="relative w-full h-full" style={{ minHeight: '200px' }}>
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
              scrcpy 窗口已弹出
            </div>
          </div>
        </>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-10 h-10 mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-red-400 mb-1">启动失败</p>
          {error && (
            <p className="text-xs text-gray-500 mb-3 px-4 text-center max-w-full truncate">{error}</p>
          )}
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
};

export default ScrcpyWindow;
