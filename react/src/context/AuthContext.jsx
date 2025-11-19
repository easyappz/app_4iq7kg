import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCurrentMember,
  login as loginApi,
  logout as logoutApi,
  register as registerApi,
} from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [currentMember, setCurrentMember] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsInitializing(false);
      return;
    }

    const storedToken = window.localStorage.getItem('authToken');

    if (!storedToken) {
      setIsInitializing(false);
      return;
    }

    setToken(storedToken);

    getCurrentMember()
      .then((response) => {
        setCurrentMember(response.data);
      })
      .catch(() => {
        window.localStorage.removeItem('authToken');
        setToken(null);
        setCurrentMember(null);
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, []);

  const handleLogin = useCallback(
    async (credentials) => {
      const response = await loginApi(credentials);

      const newToken = response.data?.token;
      const member = response.data?.member;

      if (typeof window !== 'undefined' && newToken) {
        window.localStorage.setItem('authToken', newToken);
      }

      setToken(newToken || null);
      setCurrentMember(member || null);

      navigate('/', { replace: true });

      return response;
    },
    [navigate]
  );

  const handleRegister = useCallback(
    async (data) => {
      const response = await registerApi(data);

      const newToken = response.data?.token;
      const member = response.data?.member;

      if (typeof window !== 'undefined' && newToken) {
        window.localStorage.setItem('authToken', newToken);
      }

      setToken(newToken || null);
      setCurrentMember(member || null);

      navigate('/', { replace: true });

      return response;
    },
    [navigate]
  );

  const handleLogout = useCallback(
    async () => {
      try {
        await logoutApi();
      } catch (error) {
        // Ignore logout errors
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('authToken');
      }

      setToken(null);
      setCurrentMember(null);

      navigate('/login', { replace: true });
    },
    [navigate]
  );

  const value = {
    token,
    currentMember,
    isInitializing,
    handleLogin,
    handleRegister,
    handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
