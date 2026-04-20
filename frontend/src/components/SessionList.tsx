/* eslint-disable react/prop-types */
import React, { memo } from 'react';
import { SessionResponse } from '../types/chat';

interface SessionListProps {
  sessions: SessionResponse[];
  selectedSessionId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (sessionId: string) => void;
  onCreateNew: () => void;
  onDelete: (sessionId: string) => void;
  collapsed: boolean;
  creating?: boolean;
  onQuickConnect?: (sessionId: string) => void;
  onEditDevice?: (sessionId: string, deviceIp: string, devicePort: number) => void;
}

const SessionList: React.FC<SessionListProps> = memo(({
  sessions,
  selectedSessionId,
  loading,
  error,
  onSelect,
  onCreateNew,
  onDelete,
  collapsed,
  creating = false,
  onQuickConnect,
  onEditDevice,
}) => {
  if (loading) {
    return (
      <div className="p-4">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-500">加载会话中...</p>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4">
        {collapsed ? (
          <div className="flex justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        ) : (
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 mb-4">暂无会话</p>
            <button
              onClick={onCreateNew}
              disabled={creating}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                creating
                  ? 'bg-gray-400 cursor-not-allowed text-gray-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {creating ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  创建中...
                </div>
              ) : (
                '创建第一个会话'
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (collapsed) {
    return (
      <div className="py-2 flex flex-col flex-1 min-h-0">
        {/* 新建会话按钮 - 固定在顶部 */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onCreateNew}
            disabled={creating}
            className={`w-full p-2 rounded-lg flex items-center justify-center transition-all ${
              creating
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30'
            }`}
            title={creating ? '创建中...' : '创建新会话'}
          >
            {creating ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>

        {/* 可滚动的会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {sessions.slice(0, 8).map((session) => (
            <div key={session.id} className="relative group">
              <button
                onClick={() => onSelect(session.id)}
                className={`w-full p-3 flex items-center justify-center relative group ${
                  selectedSessionId === session.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
                title={session.title || '未命名会话'}
              >
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {session.title?.charAt(0).toUpperCase() || 'C'}
                </div>

                {/* 删除按钮（悬停显示） */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(session.id);
                  }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-opacity"
                  title="删除会话"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </button>

              {/* 设备信息（如果有） */}
              {session.device_ip && session.device_port && (
                <div className="absolute bottom-0 left-0 right-0 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs p-1 flex items-center justify-between">
                  <span className="truncate">{session.device_ip}:{session.device_port}</span>
                  {onQuickConnect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickConnect(session.id);
                      }}
                      className="ml-1 px-1 py-0.5 rounded bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 hover:bg-green-300 dark:hover:bg-green-700"
                      title="快速连接"
                    >
                      📱
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {sessions.length > 8 && (
            <div className="p-2 text-center">
              <span className="text-xs text-gray-500">+{sessions.length - 8} 更多</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 flex flex-col flex-1 min-h-0">
      {/* 固定的标题和新建按钮 */}
      <div className="px-4 py-2 bg-white dark:bg-gray-800 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">设备会话</h3>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {sessions.length}
          </span>
        </div>

        {/* 新建会话按钮 - 位于右上角 */}
        <button
          onClick={onCreateNew}
          disabled={creating}
          className={`flex items-center justify-center px-3 py-1.5 rounded-lg transition-all shadow-sm text-sm ${
            creating
              ? 'bg-gray-400 cursor-not-allowed text-gray-700'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow'
          }`}
        >
          {creating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1.5"></div>
              创建中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新建会话
            </>
          )}
        </button>
      </div>

      {/* 可滚动的会话列表 */}
      <div className="flex-1 overflow-y-auto space-y-1 px-2">
        {sessions.map((session) => (
          <div key={session.id} className={`w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${
            selectedSessionId === session.id
              ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
              : ''
          }`}>
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {session.title?.charAt(0).toUpperCase() || 'C'}
            </div>

            <div className="ml-3 flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {session.title || '未命名会话'}
                </p>
                <span className="text-xs text-gray-500">
                  {formatDate(session.created_at)}
                </span>
              </div>

              {session.metadata?.engine && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  引擎: {session.metadata.engine}
                </p>
              )}

              {session.device_ip && session.device_port && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  📱 {session.device_ip}:{session.device_port}
                </div>
              )}

              {session.message_count !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {session.message_count} 条消息
                </p>
              )}
            </div>

            {/* 操作按钮区域 */}
            <div className="flex items-center space-x-2 ml-4">
              {/* 连接按钮 */}
              <button
                onClick={() => onSelect(session.id)}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                title="连接"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                连接
              </button>

              {/* 快速连接按钮 */}
              {onQuickConnect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickConnect(session.id);
                  }}
                  className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  title="快速连接"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              )}

              {/* 编辑按钮 */}
              {onEditDevice && session.device_ip && session.device_port && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditDevice(session.id, session.device_ip || '', session.device_port || 0);
                  }}
                  className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title="编辑设备"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}

              {/* 删除按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(session.id);
                }}
                className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                title="删除会话"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

SessionList.displayName = 'SessionList';

export default SessionList;