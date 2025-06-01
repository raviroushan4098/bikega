"use client";

import type { User } from '@/types';
import { DUMMY_USERS, login as apiLogin, logout as apiLogout } from '@/lib/auth-dummy';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<User | null>;
  logout: () => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'insightStreamUser';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as User;
        // Validate if this user still exists in our dummy list or if schema matches
        const isValidUser = DUMMY_USERS.some(du => du.id === parsedUser.id && du.email === parsedUser.email);
        if (isValidUser) {
           setUser(parsedUser);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const loggedInUser = await apiLogin(email, pass);
    setUser(loggedInUser);
    if (loggedInUser) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(loggedInUser));
    }
    setLoading(false);
    return loggedInUser;
  };

  const logout = async () => {
    setLoading(true);
    await apiLogout();
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    router.push('/login'); // Redirect to login after logout
    setLoading(false);
  };
  
  const isAuthenticated = !!user && !loading;

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
