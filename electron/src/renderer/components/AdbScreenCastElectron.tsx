import { useState, useEffect, useRef, useCallback } from 'react';

interface AdbScreenCastElectronProps {
  deviceIp: string;
  devicePort: number;
  autoConnect?: boolean;
  className?: string;
}

type ConnectStatus = 'disconnected' | 'connecting' | 'streaming' | 'error';

const AdbScreenCastElectron: React.FC<AdbScreenCastElectronProps> = ({
  deviceIp,
  devicePort,
  autoConnect = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<ConnectStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({ fps: 0, frameBytes: 0 });
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingPort, setPairingPort] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const fpsFrameCountRef = useRef<number>(0);
  const lastFrameBytesRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const hasStreamedRef = useRef<boolean>(false);
  const processingRef = useRef<boolean>(false);

  const handleFrame = useCallback((data: ArrayBuffer) => {
    if (!mountedRef.current) return;
    if (processingRef.current) return;

    processingRef.current = true;

    if (!hasStreamedRef.current) {
      hasStreamedRef.current = true;
      setStatus('streaming');
    }

    const blob = new Blob([data], { type: 'image/png' });
    createImageBitmap(blob).then(bitmap => {
      if (!mountedRef.current) {
        bitmap.close();
        processingRef.current = false;
        return;
      }

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
        }
      }
      bitmap.close();

      frameCountRef.current++;
      fpsFrameCountRef.current++;
      lastFrameBytesRef.current = data.byteLength;

      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setStats({
          fps: Math.round((fpsFrameCountRef.current * 1000) / (now - lastFpsTimeRef.current)),
          frameBytes: lastFrameBytesRef.current,
        });
        fpsFrameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      processingRef.current = false;
    }).catch(() => {
      processingRef.current = false;
    });
  }, []);

  const startScreencapInternal = useCallback(async () => {
    if (!window.electronAPI) return;

    const unsubFrame = window.electronAPI.onAdbScreencapFrame(handleFrame);
    cleanupRef.current = unsubFrame;

    try {
      const result = await window.electronAPI.startAdbScreencap({
        deviceIp,
        devicePort,
      });

      if (!mountedRef.current) return;

      if (result.success) {
        lastFpsTimeRef.current = Date.now();
        console.log(`[AdbScreenCastElectron] ADB 投屏启动成功 ${deviceIp}:${devicePort}`);
      } else {
        setErrorMessage(result.error || '启动 ADB 投屏失败');
        setStatus('error');
      }
    } catch (err) {
      if (mountedRef.current) {
        setErrorMessage(err instanceof Error ? err.message : '启动 ADB 投屏异常');
        setStatus('error');
      }
    }
  }, [deviceIp, devicePort, handleFrame]);

  const handleStart = useCallback(async () => {
    if (!window.electronAPI) {
      setErrorMessage('electronAPI 不可用，请确保在 Electron 环境中运行');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setErrorMessage('');
    hasStreamedRef.current = false;

    try {
      const serverResult = await window.electronAPI.checkAdbServer();
      if (!mountedRef.current) return;

      if (!serverResult.success) {
        setErrorMessage(serverResult.error || 'ADB 服务启动失败');
        setStatus('error');
        return;
      }
      console.log('[AdbScreenCastElectron] ADB 服务已就绪');
    } catch (err) {
      if (mountedRef.current) {
        setErrorMessage(err instanceof Error ? err.message : '检测 ADB 服务异常');
        setStatus('error');
      }
      return;
    }

    // 确保设备已连接（如果尚未连接，adb connect 会自动重连）
    try {
      const connectResult = await window.electronAPI.adbConnectDevice({ deviceIp, devicePort });
      if (!mountedRef.current) return;

      if (!connectResult.success) {
        setStatus('disconnected');
        setShowPairingModal(true);
        return;
      }
    } catch (err) {
      console.error('[AdbScreenCastElectron] 连接设备失败:', err);
      if (mountedRef.current) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : '连接设备失败');
      }
      return;
    }

    await startScreencapInternal();
  }, [deviceIp, devicePort, handleFrame, startScreencapInternal]);

  const handlePairSubmit = useCallback(async () => {
    if (!window.electronAPI) return;

    if (!/^\d{6}$/.test(pairingCode)) {
      setPairingError('请输入6位配对码');
      return;
    }
    const portNum = parseInt(pairingPort, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setPairingError('请输入有效的配对端口 (1-65535)');
      return;
    }

    setPairingLoading(true);
    setPairingError('');

    try {
      const pairResult = await window.electronAPI.adbPairDevice({
        deviceIp,
        pairingPort: portNum,
        code: pairingCode,
      });
      if (!mountedRef.current) return;

      if (!pairResult.success) {
        setPairingError(pairResult.error || 'ADB 配对失败');
        setPairingLoading(false);
        return;
      }

      console.log('[AdbScreenCastElectron] ADB 配对成功');
      setShowPairingModal(false);
      setPairingLoading(false);

      // 等待配对生效
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 继续启动投屏
      setStatus('connecting');
      await startScreencapInternal();
    } catch (err) {
      if (mountedRef.current) {
        setPairingError(err instanceof Error ? err.message : '配对异常');
      }
      setPairingLoading(false);
    }
  }, [deviceIp, devicePort, pairingCode, pairingPort, startScreencapInternal]);

  const handleStop = useCallback(async () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (window.electronAPI) {
      await window.electronAPI.stopAdbScreencap();
    }

    setStatus('disconnected');
    setErrorMessage('');
    frameCountRef.current = 0;
    fpsFrameCountRef.current = 0;
    hasStreamedRef.current = false;
    setStats({ fps: 0, frameBytes: 0 });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      handleStart();
    }

    return () => {
      mountedRef.current = false;
      handleStop();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-lg bg-gray-900 ${className}`}>
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
          <p className="text-sm">正在获取设备画面...</p>
          <p className="text-xs text-gray-500 mt-1">{deviceIp}:{devicePort}</p>
          <button
            onClick={handleStop}
            className="mt-4 px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
          <svg className="w-10 h-10 mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-red-400 mb-1">连接失败</p>
          {errorMessage && (
            <p className="text-xs text-gray-500 mb-3 px-4 text-center max-w-full truncate">{errorMessage}</p>
          )}
          <button
            onClick={handleStart}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            重试
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain ${
          status === 'streaming' ? '' : 'opacity-0 absolute inset-0 pointer-events-none'
        }`}
        style={{ imageRendering: 'auto' }}
      />

      {status === 'streaming' && (
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
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
            {stats.fps} FPS
          </div>
        </>
      )}

      {/* ADB WLAN 配对弹窗 */}
      {showPairingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ADB WLAN 配对</h3>
              <button
                onClick={() => { setShowPairingModal(false); setPairingError(''); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              设备尚未配对。请在 Android 设备上打开「开发者选项 &gt; 无线调试 &gt; 使用配对码配对设备」，然后输入以下信息：
            </p>

            {pairingError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4" role="alert">
                {pairingError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">设备 IP</label>
                <input
                  type="text"
                  value={deviceIp}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">连接端口（仅供参考）</label>
                <input
                  type="text"
                  value={devicePort}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  配对端口 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={pairingPort}
                  onChange={e => setPairingPort(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="例如: 41325"
                  min="1"
                  max="65535"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  配对码 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={pairingCode}
                  onChange={e => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="6位配对码"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowPairingModal(false); setPairingError(''); }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:hover:bg-gray-600"
              >
                取消
              </button>
              <button
                onClick={handlePairSubmit}
                disabled={pairingLoading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pairingLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    配对中...
                  </span>
                ) : '配对并连接'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdbScreenCastElectron;
