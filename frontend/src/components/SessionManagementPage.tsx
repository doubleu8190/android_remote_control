import React, { useState, useEffect, useCallback } from 'react';
import SessionList from './SessionList';
import CreateSessionModal from './CreateSessionModal';
import { SessionResponse } from '../types/chat';
import { chatApiService } from '../services/api';

const SessionManagementPage: React.FC = () => {

  const [sessions, setSessions] = useState<SessionResponse[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  // 设备连接相关状态
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [deviceConfig, setDeviceConfig] = useState({
    ip: '192.168.31.113',
    port: 36409
  });

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      setSessionError(null);

      const result = await chatApiService.getSessions();

      if (result.success && result.data) {
        const sessionList = Array.isArray(result.data) ? result.data : [result.data];
        setSessions(sessionList);
      } else {
        setSessionError(result.error || 'Failed to load sessions');
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // 初始化加载会话
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);



  const handleCreateNewSession = async () => {
    // 显示连接配置模态窗口
    setShowCreateSessionModal(true);
    setSessionError(null);
  };

  // 处理会话新建
  const handleSessionCreate = async (ip: string, port: number): Promise<boolean> => {
    // 防止重复连接
    if (creatingSession) {
      return false;
    }

    setCreatingSession(true);
    setSessionError('');
    setDeviceConfig({ ip, port });

    try {
      console.log(`正在创建新会话: ${ip}:${port}`);

      // 1. 创建新的聊天会话（仅数据库持久化）
      const now = new Date();
      const title = `Device: ${ip}:${port} - ${now.toLocaleTimeString()}`;
      const sessionResult = await chatApiService.createSession({
        title: title,
        device_ip: ip,
        device_port: port,
        metadata: {
          engine: 'basic',
          timestamp: now.getTime(),
          connectionType: 'android_device'
        }
      });

      if (!sessionResult.success || !sessionResult.data) {
        throw new Error('创建聊天会话失败');
      }

      const sessionId = sessionResult.data.id;
      console.log('会话创建成功，ID:', sessionId);

      if (!sessionId) {
        return false;
      }

      // 2. 关闭模态窗口
      setShowCreateSessionModal(false);

      // 3. 触发会话列表的重新渲染操作
      await loadSessions();

      console.log('会话创建成功');

      return true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建会话失败，请检查网络设置';
      setSessionError(errorMessage);
      console.error('会话创建失败:', error);
      return false;
    } finally {
      setCreatingSession(false);
    }
  };

  // 处理连接取消
  const handleCreateCancel = () => {
    setShowCreateSessionModal(false);
    setSessionError(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatApiService.deleteSession(sessionId);

      // 从列表中移除
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  // 处理快速连接
  const handleQuickConnect = (sessionId: string) => {
    window.open(`/session/${sessionId}`, '_blank');
  };

  // 处理编辑设备
  const handleEditDevice = (sessionId: string, deviceIp: string, devicePort: number) => {
    // 这里可以实现编辑设备的逻辑，暂时留空
    console.log('Edit device:', sessionId, deviceIp, devicePort);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* 会话管理区域 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">设备会话</h2>

            <SessionList
              sessions={sessions}
              selectedSessionId={null}
              loading={loadingSessions}
              error={sessionError}
              onSelect={(sessionId) => {
                // 点击会话项时，在新标签页打开会话详情
                window.open(`/session/${sessionId}`, '_blank');
              }}
              onCreateNew={handleCreateNewSession}
              onDelete={handleDeleteSession}
              collapsed={false}
              creating={creatingSession}
              onQuickConnect={handleQuickConnect}
              onEditDevice={handleEditDevice}
            />
          </div>
        </div>
      </main>

      {/* 新建会话模态窗口 */}
      <CreateSessionModal
        isOpen={showCreateSessionModal}
        defaultIp={deviceConfig.ip}
        defaultPort={deviceConfig.port}
        onCreate={handleSessionCreate}
        onCancel={handleCreateCancel}
        isLoading={creatingSession}
        errorMessage={sessionError || undefined}
      />
    </div>
  );
};

export default SessionManagementPage;