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
    const clearStoredAuthData = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
      } catch (err) {
        console.warn('[LocalStorage clear error]', err);
      }
      sessionStorage.clear();
      if (typeof document !== 'undefined' && document.cookie) {
        document.cookie.split(';').forEach((c) => {
          document.cookie = c
            .replace(/^ +/, '')
            .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
        });
      }
    };

    const handleUnauthorized = () => {
      clearStoredAuthData();
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    let unsub;

    // Check for active Supabase session (e.g. from Google OAuth redirect)
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
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
          // Backend user will be auto-provisioned on first API call via
          // the get_current_user dependency — no need to call /auth/me here.
          setIsLoading(false);
          return;
        }

        // No Supabase session — fall through to localStorage token check.
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          api.get('/auth/me')
            .then((res) => {
              setUser(res.data);
              localStorage.setItem('user', JSON.stringify(res.data));
            })
            .catch(() => {
              // /auth/me rejected the stored token — clear everything.
              clearStoredAuthData();
              setUser(null);
              setToken(null);
            })
            .finally(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      }).catch((err) => {
        console.warn('[Supabase session check]', err);
        setIsLoading(false);
      });

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
          clearStoredAuthData();
          setUser(null);
          setToken(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Keep localStorage in sync with the refreshed Supabase access token
          localStorage.setItem('token', session.access_token);
          setToken(session.access_token);
        }
      });

      unsub = () => subscription?.unsubscribe();
    } else {
      // No Supabase client configured — pure backend JWT flow
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        api.get('/auth/me')
          .then((res) => {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
          })
          .catch(() => {
            clearStoredAuthData();
            setUser(null);
            setToken(null);
          })
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      if (unsub) unsub();
    };
  }, []);

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

  const logout = async () => {
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('[Supabase signOut error]', error);
        }
      } catch (err) {
        console.error('[Supabase signOut exception]', err);
      }
    }
    clearStoredAuthData();
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
