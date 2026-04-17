import React from 'react';
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
}

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  selectedSessionId,
  loading,
  error,
  onSelect,
  onCreateNew,
  onDelete,
  collapsed,
  creating = false,
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
            <p className="text-sm text-gray-500">Loading sessions...</p>
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
            <p className="text-gray-500 mb-4">No chat sessions yet</p>
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
                  Creating...
                </div>
              ) : (
                'Create First Session'
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
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (collapsed) {
    return (
      <div className="py-2 flex flex-col h-full">
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
            title={creating ? 'Creating...' : 'Create new session'}
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
            <button
              key={session.id}
              onClick={() => onSelect(session.id)}
              className={`w-full p-3 flex items-center justify-center relative group ${
                selectedSessionId === session.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
              title={session.title || 'Untitled Session'}
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
                title="Delete session"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </button>
          ))}

          {sessions.length > 8 && (
            <div className="p-2 text-center">
              <span className="text-xs text-gray-500">+{sessions.length - 8} more</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 flex flex-col h-full">
      {/* 固定的标题和新建按钮 */}
      <div className="px-4 py-2 space-y-2 bg-white dark:bg-gray-800 z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Chat Sessions</h3>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
            {sessions.length}
          </span>
        </div>

        {/* 新建会话按钮 - 固定在顶部 */}
        <button
          onClick={onCreateNew}
          disabled={creating}
          className={`w-full flex items-center justify-center px-4 py-2.5 rounded-lg transition-all shadow-sm ${
            creating
              ? 'bg-gray-400 cursor-not-allowed text-gray-700'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow'
          }`}
        >
          {creating ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Creating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Chat Session
            </>
          )}
        </button>
      </div>

      {/* 可滚动的会话列表 */}
      <div className="flex-1 overflow-y-auto space-y-1 px-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`w-full flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group ${
              selectedSessionId === session.id
                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                : ''
            }`}
          >
            <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
              {session.title?.charAt(0).toUpperCase() || 'C'}
            </div>

            <div className="ml-3 flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {session.title || 'Untitled Session'}
                </p>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {formatDate(session.created_at)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-opacity"
                    title="Delete session"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {session.metadata?.engine && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Engine: {session.metadata.engine}
                </p>
              )}

              {session.message_count !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {session.message_count} messages
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SessionList;