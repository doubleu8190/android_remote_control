import React, { useState, useEffect } from 'react';
import { chatApiService } from '../services/api';


import { UserInfo } from '../types/auth';

const ProfilePage: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载用户信息
  const loadUserInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await chatApiService.getCurrentUser();
      if (response.success && response.data) {
        setUserInfo(response.data);
      } else {
        setError(response.error || '加载用户信息失败');
      }
    } catch (err) {
      setError('加载用户信息失败');
      console.error('Error loading user info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserInfo();
  }, []);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">用户信息</h1>

      {/* 错误信息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* 用户信息卡片 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {loading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        ) : userInfo ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">个人资料</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    用户名
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    {userInfo.username}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    邮箱
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    {userInfo.email || '未设置'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    姓名
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    {userInfo.full_name || '未设置'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    账户创建时间
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md">
                    {userInfo.created_at ? new Date(userInfo.created_at).toLocaleString() : '未设置'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            无法加载用户信息
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;