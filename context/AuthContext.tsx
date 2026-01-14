'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (userData: any) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const clearSession = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // Ignore errors when clearing session
    }
    setUser(null);
    // Only redirect if not already on login page
    if (pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  };

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        // If user was deleted, authenticated will be false
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          // User was deleted or session invalid, clear session
          await clearSession();
        }
      } else {
        // Session invalid, clear it
        await clearSession();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    
    // Periodically check if user still exists (every 30 seconds)
    const interval = setInterval(() => {
      if (user) {
        // Only check if user is logged in
        checkAuth();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Check auth on route changes (catches deleted users immediately)
  useEffect(() => {
    if (user && pathname && pathname.startsWith('/dashboard')) {
      checkAuth();
    }
  }, [pathname]);

  const login = (userData: any) => {
    setUser(userData);
    router.push('/dashboard');
  };

  const logout = async () => {
    await clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
