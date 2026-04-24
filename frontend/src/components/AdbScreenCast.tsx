import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatApiService } from '../services/api';

interface AdbScreenCastProps {
  sessionId: string;
  className?: string;
  maxFps?: number;
}

const AdbScreenCast: React.FC<AdbScreenCastProps> = ({
  sessionId,
  className = '',
  maxFps = 8,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'streaming' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({ fps: 0, frameBytes: 0 });
  const pollingRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const fpsFrameCountRef = useRef<number>(0);
  const lastFrameBytesRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const retryCountRef = useRef<number>(0);

  const pollInterval = Math.floor(1000 / maxFps);

  const renderFrame = useCallback(async () => {
    if (!mountedRef.current || pollingRef.current) return;

    pollingRef.current = true;
    try {
      const blob = await chatApiService.getScreencap(sessionId);
      if (!mountedRef.current) return;

      if (!blob) {
        retryCountRef.current++;
        if (retryCountRef.current >= 3) {
          setStatus('error');
          setErrorMessage('无法获取设备截屏，请检查ADB连接');
        }
        pollingRef.current = false;
        return;
      }

      retryCountRef.current = 0;
      setStatus('streaming');

      const bitmap = await createImageBitmap(blob);
      if (!mountedRef.current) {
        bitmap.close();
        pollingRef.current = false;
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
      lastFrameBytesRef.current = blob.size;

      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setStats({
          fps: Math.round((fpsFrameCountRef.current * 1000) / (now - lastFpsTimeRef.current)),
          frameBytes: lastFrameBytesRef.current,
        });
        fpsFrameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }
    } catch (err) {
      if (mountedRef.current) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : '截屏获取失败');
      }
    } finally {
      pollingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    setStatus('connecting');
    lastFpsTimeRef.current = Date.now();

    const timer = setInterval(() => {
      if (mountedRef.current) {
        renderFrame();
      }
    }, pollInterval);

    renderFrame();

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [renderFrame, pollInterval]);

  return (
    <div className={`relative ${className}`}>
      {status === 'idle' || status === 'connecting' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">正在获取设备画面...</p>
          </div>
        </div>
      ) : status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center p-4">
            <svg className="w-10 h-10 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-.633-1.964-.633-2.732 0L3.34 16c-.77.633.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{errorMessage}</p>
            <button
              onClick={() => {
                setStatus('connecting');
                setErrorMessage('');
                retryCountRef.current = 0;
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              重新连接
            </button>
          </div>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain ${status === 'streaming' ? '' : 'opacity-0'}`}
        style={{ imageRendering: 'auto' }}
      />

      {status === 'streaming' && (
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          {stats.fps} FPS
        </div>
      )}
    </div>
  );
};

export default AdbScreenCast;
