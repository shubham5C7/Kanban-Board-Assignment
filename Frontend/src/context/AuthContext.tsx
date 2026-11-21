import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Membership } from '../types';
import { api } from '../services/api';
import { disconnectSocket } from '../services/socket';

interface AuthContextType {
  user: User | null;
  memberships: Membership[];
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [token, setToken] = useState<string | null>(localStorage.getItem('kanban_token') || sessionStorage.getItem('kanban_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setMemberships(data.memberships);
    } catch (err) {
      console.error('[Auth] Failed to fetch profile', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string, rememberMe = false) => {
    setIsLoading(true);
    try {
      const data = await api.login({ email, password, rememberMe });
      localStorage.removeItem('kanban_token');
      sessionStorage.removeItem('kanban_token');
      (rememberMe ? localStorage : sessionStorage).setItem('kanban_token', data.token);
      setToken(data.token);
      setUser(data.user);
      await fetchProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      await api.register({ name, email, password });
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('kanban_token');
    sessionStorage.removeItem('kanban_token');
    setToken(null);
    setUser(null);
    setMemberships([]);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
