import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { AppLoading } from './ui.jsx';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppLoading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role !== 'super_admin' && !roles.includes(user.role)) {
    return <Navigate to="/access-denied" replace />;
  }
  return children;
}
