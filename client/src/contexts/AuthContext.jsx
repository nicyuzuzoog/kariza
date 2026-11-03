import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { authStorage } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (authStorage.getToken() ? authStorage.getUser() : null));
  const [loading, setLoading] = useState(() => Boolean(authStorage.getToken()));

  useEffect(() => {
    let active = true;
    const token = authStorage.getToken();

    if (!token) {
      authStorage.clear();
      setUser(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (!active) return;
        setUser(data.user);
        authStorage.saveUser(data.user);
      })
      .catch(() => {
        if (!active) return;
        authStorage.clear();
        setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    authStorage.save(data.token, data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  const applyUser = useCallback((nextUser) => {
    if (!nextUser) return;
    setUser(nextUser);
    authStorage.saveUser(nextUser);
  }, []);

  const updateSession = useCallback((token, nextUser) => {
    if (token) {
      authStorage.save(token, nextUser);
    } else {
      authStorage.saveUser(nextUser);
    }
    setUser(nextUser);
  }, []);

  const hasRole = useCallback(
    (...roles) => Boolean(user && (user.role === 'super_admin' || roles.flat().includes(user.role))),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user && authStorage.getToken()),
      login,
      logout,
      applyUser,
      updateSession,
      hasRole,
    }),
    [user, loading, login, logout, applyUser, updateSession, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
