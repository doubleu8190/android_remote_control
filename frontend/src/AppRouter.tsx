import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import ProtectedRoute from './components/ProtectedRoute';
import ChatLayout from './components/ChatLayout';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 默认路径重定向到/chat */}
      <Route path="/" element={<Navigate to="/chat" replace />} />

      {/* 登录页面 - 已认证用户无法访问 */}
      <Route
        path="/login"
        element={
          <ProtectedRoute requireAuth={false}>
            <LoginPage />
          </ProtectedRoute>
        }
      />

      {/* 注册页面 - 已认证用户无法访问 */}
      <Route
        path="/register"
        element={
          <ProtectedRoute requireAuth={false}>
            <RegistrationPage />
          </ProtectedRoute>
        }
      />

      {/* 聊天主页面 - 需要认证 */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatLayout />
          </ProtectedRoute>
        }
      />

      {/* 404页面 */}
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
};

export default AppRouter;