
"use client";

import type { User } from '@/types';
import { login as apiLogin, logout as apiLogout, getUserById } from '@/lib/user-service'; // Updated import
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

const AUTH_STORAGE_KEY = 'insightStreamUser'; // Stores only the user ID now

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const attemptLoadUserFromStorage = async () => {
      const storedUserId = localStorage.getItem(AUTH_STORAGE_KEY);
      if (storedUserId) {
        try {
          // Fetch the full user object from Firestore using the stored ID
          const fetchedUser = await getUserById(storedUserId);
          if (fetchedUser) {
            setUser(fetchedUser);
          } else {
            // User ID in localStorage but not in Firestore (e.g., deleted)
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        } catch (error) {
          console.error("Failed to fetch stored user from Firestore:", error);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
      setLoading(false);
    };
    attemptLoadUserFromStorage();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    const loggedInUser = await apiLogin(email, pass);
    setUser(loggedInUser);
    if (loggedInUser) {
      // Store only the user ID in localStorage
      localStorage.setItem(AUTH_STORAGE_KEY, loggedInUser.id);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY); 
    }
    setLoading(false);
    return loggedInUser;
  };

  const logout = async () => {
    setLoading(true);
    await apiLogout(); // This is a dummy apiLogout for now
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    // Optionally, call Firebase Auth signOut if you integrate it later
    // import { getAuth, signOut } from "firebase/auth";
    // const auth = getAuth(app); // app from your firebase.ts
    // await signOut(auth);
    router.push('/login'); 
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
