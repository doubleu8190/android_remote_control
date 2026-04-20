import React, { useState, useEffect, useRef } from 'react';

interface VideoStreamPlayerProps {
  /** WebSocket服务器地址 */
  wsUrl?: string;
  /** 是否自动连接 */
  autoConnect?: boolean;
  /** 连接状态回调 */
  onConnectionChange?: (connected: boolean) => void;
  /** 错误回调 */
  onError?: (error: string) => void;
  /** 自定义样式 */
  className?: string;
}

const VideoStreamPlayer: React.FC<VideoStreamPlayerProps> = ({
  wsUrl = `ws://${window.location.hostname}:8088`,
  autoConnect = true,
  onConnectionChange,
  onError,
  className = '',
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [stats, setStats] = useState({
    fps: 0,
    bytesReceived: 0,
    connectionTime: 0,
    lastFrameTime: 0,
  });

  const connectionStartTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const lastFpsUpdate = useRef<number>(0);
  const bytesReceived = useRef<number>(0);
  const lastFrameTimestamp = useRef<number>(0);
  const currentFrameUrl = useRef<string>('');
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理Blob URL
  const cleanupFrameUrl = () => {
    if (currentFrameUrl.current) {
      URL.revokeObjectURL(currentFrameUrl.current);
      currentFrameUrl.current = '';
    }
  };

  // 处理JPEG帧数据
  const processFrame = (data: ArrayBuffer) => {
    try {
      bytesReceived.current += data.byteLength;
      frameCount.current++;

      // 创建Blob URL
      cleanupFrameUrl();
      const blob = new Blob([data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      currentFrameUrl.current = url;

      // 更新图像
      if (imgRef.current) {
        imgRef.current.src = url;
      }

      // 更新统计数据
      const now = Date.now();
      lastFrameTimestamp.current = now;

      if (now - lastFpsUpdate.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastFpsUpdate.current));
        setStats(prev => ({
          ...prev,
          fps,
          bytesReceived: bytesReceived.current,
          connectionTime: Math.floor((now - connectionStartTime.current) / 1000),
          lastFrameTime: now,
        }));
        frameCount.current = 0;
        lastFpsUpdate.current = now;
      }
    } catch (error) {
      console.error('处理视频帧失败:', error);
    }
  };

  // 连接WebSocket
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket已连接，无需重新连接');
      return;
    }

    // 清理之前的连接
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');
    setErrorMessage('');
    connectionStartTime.current = Date.now();
    reconnectAttempts.current = 0;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        console.log('WebSocket连接成功');
        setIsConnected(true);
        setConnectionStatus('connected');
        setIsPlaying(true);
        reconnectAttempts.current = 0;
        onConnectionChange?.(true);
      };

      ws.onmessage = (event) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            processFrame(event.data);
          } else if (typeof event.data === 'string') {
            // 处理文本消息（可能是JSON错误信息）
            try {
              const message = JSON.parse(event.data);
              if (message.type === 'error') {
                setErrorMessage(`服务器错误: ${message.message}`);
                onError?.(`服务器错误: ${message.message}`);
                // 延迟断开连接，让用户看到错误信息
                setTimeout(() => {
                  if (wsRef.current === ws) {
                    ws.close(1000, '服务器错误');
                  }
                }, 2000);
              }
            } catch (jsonError) {
              console.warn('收到非JSON文本消息:', event.data);
            }
          } else {
            console.warn('收到未知类型数据，忽略');
          }
        } catch (error) {
          console.error('处理WebSocket消息失败:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket连接错误:', error);
        setErrorMessage('WebSocket连接错误');
        onError?.('WebSocket连接错误');
        setConnectionStatus('disconnected');
        setIsConnected(false);
        setIsPlaying(false);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket连接关闭: code=${event.code}, reason=${event.reason}`);
        setConnectionStatus('disconnected');
        setIsConnected(false);
        setIsPlaying(false);
        onConnectionChange?.(false);
        wsRef.current = null;

        // 自动重连逻辑
        if (reconnectAttempts.current < maxReconnectAttempts && !event.wasClean) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          console.log(`尝试重新连接 (${reconnectAttempts.current}/${maxReconnectAttempts})，等待 ${delay}ms`);
          
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('执行自动重连...');
            connectWebSocket();
          }, delay);
        }
      };
    } catch (error) {
      console.error('创建WebSocket失败:', error);
      setErrorMessage(`创建WebSocket失败: ${error instanceof Error ? error.message : '未知错误'}`);
      onError?.(`创建WebSocket失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setConnectionStatus('disconnected');
    }
  };

  // 断开WebSocket连接
  const disconnectWebSocket = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, '用户手动断开');
      }
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsPlaying(false);
    setConnectionStatus('disconnected');
    onConnectionChange?.(false);
    reconnectAttempts.current = maxReconnectAttempts; // 停止自动重连
  };

  // 切换播放状态
  const togglePlay = () => {
    if (isPlaying) {
      disconnectWebSocket();
    } else {
      connectWebSocket();
    }
  };

  // 手动重新连接
  const handleReconnect = () => {
    disconnectWebSocket();
    setTimeout(() => {
      connectWebSocket();
    }, 500);
  };

  // 初始化效果
  useEffect(() => {
    // 自动连接
    if (autoConnect) {
      connectWebSocket();
    }

    // 清理函数
    return () => {
      disconnectWebSocket();
      cleanupFrameUrl();
    };
  }, [wsUrl, autoConnect]);

  // 计算延迟
  const latency = stats.lastFrameTime ? Date.now() - stats.lastFrameTime : 0;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 视频播放区域 */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden flex-1">
        <img
          ref={imgRef}
          className="w-full h-full object-contain bg-black"
          alt="手机屏幕镜像"
          onError={(e) => {
            console.error('图像加载失败');
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        
        {/* 连接状态覆盖层 */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80">
            {connectionStatus === 'connecting' ? (
              <>
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-white text-lg">正在连接视频流...</p>
                <p className="text-gray-300 text-sm mt-2">{wsUrl}</p>
                <p className="text-gray-400 text-xs mt-1">
                  重试 {reconnectAttempts.current}/{maxReconnectAttempts}
                </p>
              </>
            ) : (
              <>
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-white text-lg">视频流未连接</p>
                <p className="text-gray-300 text-sm mt-2">点击下方按钮开始播放</p>
              </>
            )}
          </div>
        )}
        
        {/* 统计数据 */}
        {isConnected && (
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded flex gap-4">
            <div>
              <span className="text-gray-300">FPS: </span>
              <span className="font-medium">{stats.fps}</span>
            </div>
            <div>
              <span className="text-gray-300">延迟: </span>
              <span className={`font-medium ${latency > 200 ? 'text-yellow-400' : latency > 500 ? 'text-red-400' : 'text-green-400'}`}>
                {latency}ms
              </span>
            </div>
            <div>
              <span className="text-gray-300">数据: </span>
              <span className="font-medium">{Math.round(stats.bytesReceived / 1024)} KB</span>
            </div>
          </div>
        )}
      </div>

      {/* 控制面板 */}
      <div className="mt-4 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-medium">Android屏幕镜像</h3>
            <p className="text-gray-400 text-sm">
              状态: 
              <span className={`ml-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {isConnected ? '已连接' : '未连接'}
              </span>
              {isConnected && (
                <span className="ml-2 text-gray-400">
                  • 分辨率: {SCRCPY_MAX_SIZE}p
                </span>
              )}
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={togglePlay}
              className={`px-4 py-2 rounded-lg font-medium ${
                isPlaying 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isPlaying ? '停止镜像' : '开始镜像'}
            </button>
            
            {isConnected && (
              <button
                onClick={handleReconnect}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                重新连接
              </button>
            )}
          </div>
        </div>

        {/* 错误信息 */}
        {errorMessage && (
          <div className="mt-3 p-3 bg-red-900 bg-opacity-30 border border-red-700 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-red-300 text-sm">{errorMessage}</p>
                <p className="text-gray-400 text-xs mt-1">
                  请检查：1. scrcpy服务是否运行 2. 设备是否连接 3. 网络是否正常
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 连接信息 */}
        <div className="mt-3 text-sm text-gray-400">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>服务器: <code className="ml-1 px-1 py-0.5 bg-gray-700 rounded">{wsUrl}</code></span>
          </div>
          <div className="flex items-center mt-1">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>编码格式: MJPEG (JPEG帧流)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// 从环境变量或默认值获取scrcpy配置
const SCRCPY_MAX_SIZE = import.meta.env?.VITE_SCRCPY_MAX_SIZE || '800';

export default VideoStreamPlayer;