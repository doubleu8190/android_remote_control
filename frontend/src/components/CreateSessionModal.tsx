import React, { useState, useEffect } from 'react';

interface CreateSessionModalProps {
  /** 是否显示模态窗口 */
  isOpen: boolean;
  /** 默认IP地址 */
  defaultIp?: string;
  /** 默认端口号 */
  defaultPort?: number;
  /** 新建回调函数，接收IP和端口参数 */
  onCreate: (ip: string, port: number) => Promise<boolean>;
  /** 取消回调函数 */
  onCancel: () => void;
  /** 加载状态 */
  isLoading?: boolean;
  /** 错误信息 */
  errorMessage?: string;
}

const CreateSessionModal: React.FC<CreateSessionModalProps> = ({
  isOpen,
  defaultIp = '192.168.31.113',
  defaultPort = 36409,
  onCreate,
  onCancel,
  isLoading = false,
  errorMessage = '',
}) => {
  const [ipAddress, setIpAddress] = useState(defaultIp);
  const [port, setPort] = useState(defaultPort);
  const [ipError, setIpError] = useState('');
  const [portError, setPortError] = useState('');

  // 当默认值改变时更新状态
  useEffect(() => {
    if (isOpen) {
      setIpAddress(defaultIp);
      setPort(defaultPort);
      setIpError('');
      setPortError('');
    }
  }, [isOpen, defaultIp, defaultPort]);

  // 验证IP地址格式
  const validateIpAddress = (ip: string): boolean => {
    // 简单的IP地址格式验证
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    if (!ip) {
      setIpError('IP地址不能为空');
      return false;
    }
    
    if (!ipRegex.test(ip)) {
      setIpError('请输入有效的IPv4地址（如：192.168.1.100）');
      return false;
    }
    
    setIpError('');
    return true;
  };

  // 验证端口号
  const validatePort = (port: number): boolean => {
    
    if (!port) {
      setPortError('端口号不能为空');
      return false;
    }
    
    if (isNaN(port)) {
      setPortError('端口号必须是数字');
      return false;
    }
    
    if (port < 1 || port > 65535) {
      setPortError('端口号必须在1-65535之间');
      return false;
    }
    
    setPortError('');
    return true;
  };

  // 处理IP地址输入变化
  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIpAddress(value);
    if (ipError) validateIpAddress(value);
  };

  // 处理端口输入变化
  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setPort(0);
      if (portError) validatePort(0);
    } else {
      const numValue = parseInt(value);
      setPort(numValue);
      if (portError) validatePort(numValue);
    }
  };

  // 处理连接按钮点击
  const handleCreate = async () => {
    const isIpValid = validateIpAddress(ipAddress);
    const isPortValid = validatePort(port);
    
    if (isIpValid && isPortValid) {
      try {
        const success = await onCreate(ipAddress, port);
        if (success) {
          // 成功连接后清空错误信息
          setIpError('');
          setPortError('');
        }
      } catch (error) {
        console.error('连接失败:', error);
      }
    }
  };

  // 处理取消按钮点击
  const handleCancel = () => {
    setIpError('');
    setPortError('');
    onCancel();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleCreate();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // 如果不显示，返回null
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onKeyDown={handleKeyDown}
      >
        <div className="p-6">
          {/* 标题 */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              新建会话
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              请输入Android设备的IP地址和端口号以创建会话
            </p>
          </div>

          {/* IP地址输入 */}
          <div className="mb-5">
            <label htmlFor="ip-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              IP地址
            </label>
            <input
              id="ip-address"
              type="text"
              value={ipAddress}
              onChange={handleIpChange}
              placeholder="例如：192.168.1.100"
              className={`w-full px-4 py-3 border rounded-lg text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 ${
                ipError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={isLoading}
              autoFocus
            />
            {ipError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{ipError}</p>
            )}
          </div>

          {/* 端口号输入 */}
          <div className="mb-6">
            <label htmlFor="port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              端口号
            </label>
            <input
              id="port"
              type="number"
              value={port}
              onChange={handlePortChange}
              placeholder="例如：5555"
              className={`w-full px-4 py-3 border rounded-lg text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 ${
                portError ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-600'
              }`}
              disabled={isLoading}
              min="1"
              max="65535"
            />
            {portError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{portError}</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              通常Android设备的ADB端口为5555
            </p>
          </div>

          {/* 错误信息显示 */}
          {errorMessage && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  新建中...
                </>
              ) : (
                '新建'
              )}
            </button>
          </div>
        </div>

        {/* 底部提示信息 */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>连接成功后，系统将同时启动：</p>
            <ul className="mt-1 space-y-1">
              <li className="flex items-center">
                <svg className="w-3 h-3 text-green-500 mr-1.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>聊天会话通信</span>
              </li>
              <li className="flex items-center">
                <svg className="w-3 h-3 text-green-500 mr-1.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span>手机屏幕实时镜像</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSessionModal;