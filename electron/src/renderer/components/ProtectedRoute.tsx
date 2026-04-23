import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
}

const ProtectedRoute = ({ children, requireAuth = true }: ProtectedRouteProps) => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // 检查认证状态
  useEffect(() => {
    const checkAuth = () => {
      // 从localStorage检查认证状态
      const authStatus = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(authStatus);
    };

    checkAuth();

    // 监听storage变化
    const handleStorageChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 如果还在检查认证状态，显示加载中
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">检查认证状态...</p>
        </div>
      </div>
    );
  }

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