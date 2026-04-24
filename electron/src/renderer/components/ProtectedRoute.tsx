import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute = ({ children, requireAuth = true }: ProtectedRouteProps) => {
  const location = useLocation();
  
  // 直接从localStorage检查认证状态，每次渲染都会重新检查
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  // 如果需要认证但用户未登录，重定向到登录页面
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 如果不需要认证但用户已登录，重定向到首页
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/sessions" replace />;
  }

  // 认证状态符合要求，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;