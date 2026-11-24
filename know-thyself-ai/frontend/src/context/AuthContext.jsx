import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('know_thyself_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      const token = localStorage.getItem('know_thyself_token');
      if (token) {
        try {
          const res = await authService.getMe();
          setUser(res.data);
          localStorage.setItem('know_thyself_user', JSON.stringify(res.data));
        } catch (err) {
          console.error("Auth verification failed:", err);
          localStorage.removeItem('know_thyself_token');
          localStorage.removeItem('know_thyself_user');
          setUser(null);
        }
      }
      setLoading(false);
    };
    verifyUser();
  }, []);

  const login = async (email, password) => {
    const res = await authService.login({ email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('know_thyself_token', access_token);
    localStorage.setItem('know_thyself_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, confirmPassword) => {
    const res = await authService.register({
      name,
      email,
      password,
      confirm_password: confirmPassword,
    });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('know_thyself_token', access_token);
    localStorage.setItem('know_thyself_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const demoLogin = async () => {
    const res = await authService.demoLogin();
    const { access_token, user: userData } = res.data;
    localStorage.setItem('know_thyself_token', access_token);
    localStorage.setItem('know_thyself_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('know_thyself_token');
    localStorage.removeItem('know_thyself_user');
    setUser(null);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedData };
      localStorage.setItem('know_thyself_user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, demoLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
