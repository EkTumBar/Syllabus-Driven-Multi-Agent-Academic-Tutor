import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { getUserRole, getRoleBadgeStyle, getRoleAccessLevel } from './roleUtils';

import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    // Check for active Supabase session (e.g. from Google OAuth redirect)
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session && !localStorage.getItem('token')) {
          const supabaseToken = session.access_token;
          const u = session.user;
          const fullName = u.user_metadata?.full_name || '';
          const nameParts = fullName.split(' ');
          const mapped = {
            id: u.id,
            email: u.email,
            role: u.user_metadata?.role || 'student',
            first_name: u.user_metadata?.first_name || nameParts[0] || '',
            last_name: u.user_metadata?.last_name || nameParts.slice(1).join(' ') || '',
            avatar_url: u.user_metadata?.avatar_url || '',
          };
          localStorage.setItem('token', supabaseToken);
          localStorage.setItem('user', JSON.stringify(mapped));
          setToken(supabaseToken);
          setUser(mapped);
        }
      }).catch((err) => console.warn('[Supabase session check]', err));

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const supabaseToken = session.access_token;
          const u = session.user;
          const fullName = u.user_metadata?.full_name || '';
          const nameParts = fullName.split(' ');
          const mapped = {
            id: u.id,
            email: u.email,
            role: u.user_metadata?.role || 'student',
            first_name: u.user_metadata?.first_name || nameParts[0] || '',
            last_name: u.user_metadata?.last_name || nameParts.slice(1).join(' ') || '',
            avatar_url: u.user_metadata?.avatar_url || '',
          };
          localStorage.setItem('token', supabaseToken);
          localStorage.setItem('user', JSON.stringify(mapped));
          setToken(supabaseToken);
          setUser(mapped);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setToken(null);
        }
      });

      // Cleanup listener on unmount
      var unsub = () => subscription?.unsubscribe();
    }

    // Verify existing token on mount
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          // If the token was a valid Supabase OAuth token, avoid clobbering user
          if (!supabase) {
            setUser(null);
            setToken(null);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      if (unsub) unsub();
    };
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const signup = async (email, password, role = 'student') => {
    const res = await api.post('/auth/signup', { email, password, role });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
    if (typeof document !== 'undefined' && document.cookie) {
      document.cookie.split(';').forEach((c) => {
        document.cookie = c
          .replace(/^ +/, '')
          .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
      });
    }
    setUser(null);
    setToken(null);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const next = { ...prev, ...updatedData };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const forgotPassword = async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  };

  const isAuthenticated = !!token && !!user;
  const currentRole = getUserRole(user, isAuthenticated);
  const isAdmin = currentRole === 'Admin';
  const isStudent = currentRole === 'Student';
  const isGuest = currentRole === 'Guest';
  const accessLevel = getRoleAccessLevel(currentRole);

  const value = {
    user,
    token,
    isLoading,
    loading: isLoading,
    isAuthenticated,
    role: currentRole,
    roleBadge: currentRole,
    isAdmin,
    isStudent,
    isGuest,
    accessLevel,
    login,
    signup,
    logout,
    updateUser,
    forgotPassword,
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

export { getUserRole, getRoleBadgeStyle, getRoleAccessLevel };
