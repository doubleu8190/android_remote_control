import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import RegistrationPage from './components/RegistrationPage';
import ProtectedRoute from './components/ProtectedRoute';
import SessionManagementPage from './components/SessionManagementPage';
import SessionDetailPage from './components/SessionDetailPage';
import LLMManagementPage from './components/LLMManagementPage';
import ProfilePage from './components/ProfilePage';

const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* 默认路径重定向到/sessions */}
      <Route path="/" element={<Navigate to="/sessions" replace />} />

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

      {/* 会话管理页面 - 需要认证 */}
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <SessionManagementPage />
          </ProtectedRoute>
        }
      />

      {/* 会话详情页面 - 需要认证 */}
      <Route
        path="/session/:sessionId"
        element={
          <ProtectedRoute>
            <SessionDetailPage />
          </ProtectedRoute>
        }
      />

      {/* 用户信息页面 - 需要认证 */}
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      {/* LLM管理页面 - 需要认证 */}
      <Route
        path="/llm"
        element={
          <ProtectedRoute>
            <LLMManagementPage />
          </ProtectedRoute>
        }
      />

      {/* 404页面 */}
      <Route path="*" element={<Navigate to="/sessions" replace />} />
    </Routes>
  );
};

export default AppRouter;