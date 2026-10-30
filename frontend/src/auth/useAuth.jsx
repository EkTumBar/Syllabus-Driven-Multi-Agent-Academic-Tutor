import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { getUserRole, getRoleBadgeStyle, getRoleAccessLevel } from './roleUtils';

import { supabase } from '../supabaseClient';

const clearStoredAuthData = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) {
        localStorage.removeItem(key);
      }
    });
  } catch (err) {
    console.warn('[LocalStorage clear error]', err);
  }
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn('[SessionStorage clear error]', err);
  }
  if (typeof document !== 'undefined' && document.cookie) {
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });
  }
};

async function performLogout(supabaseClient, setUser, setToken) {
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('[Supabase signOut error]', error);
      }
    } catch (err) {
      console.error('[Supabase signOut exception]', err);
    }
  }
  clearStoredAuthData();
  if (typeof setUser === 'function') setUser(null);
  if (typeof setToken === 'function') setToken(null);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [isLoading, setIsLoading] = useState(true);
  // True only once the profile (including role) has been confirmed by the
  // backend in this page load. A role cached in localStorage is never trusted.
  const [profileVerified, setProfileVerified] = useState(false);
  const verifiedTokenRef = useRef(null);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredAuthData();
      setUser(null);
      setToken(null);
      setProfileVerified(false);
      verifiedTokenRef.current = null;
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);

    let isMounted = true;
    let unsub;

    // The backend is the single source of truth for the user's profile/role.
    // Supabase `user_metadata` is editable by the user, so it is never used for roles.
    const applySupabaseSession = async (session) => {
      const supabaseToken = session.access_token;
      if (verifiedTokenRef.current === supabaseToken) return;

      localStorage.setItem('token', supabaseToken);
      setToken(supabaseToken);
      try {
        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${supabaseToken}` },
        });
        if (!isMounted) return;
        localStorage.setItem('user', JSON.stringify(res.data));
        setUser(res.data);
        setProfileVerified(true);
        verifiedTokenRef.current = supabaseToken;
      } catch (err) {
        console.warn('[Auth] Backend rejected the Supabase session:', err?.response?.status || err?.message);
        if (!isMounted) return;
        verifiedTokenRef.current = null;
        setProfileVerified(false);
        await performLogout(supabase, setUser, setToken);
      }
    };

    // Validate a backend-issued token that is already in localStorage.
    const verifyStoredToken = () => {
      api.get('/auth/me')
        .then((res) => {
          if (isMounted && localStorage.getItem('token')) {
            setUser(res.data);
            localStorage.setItem('user', JSON.stringify(res.data));
            setProfileVerified(true);
          }
        })
        .catch(() => {
          // /auth/me rejected the stored token — clear everything.
          if (isMounted) {
            clearStoredAuthData();
            setUser(null);
            setToken(null);
            setProfileVerified(false);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    };

    // Check for active Supabase session (e.g. from Google OAuth redirect)
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session) {
          applySupabaseSession(session).finally(() => {
            if (isMounted) setIsLoading(false);
          });
          return;
        }

        // No Supabase session — fall through to localStorage token check.
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          verifyStoredToken();
        } else {
          setIsLoading(false);
        }
      }).catch((err) => {
        console.warn('[Supabase session check]', err);
        if (isMounted) setIsLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_IN' && session) {
          // Defer: awaiting other Supabase/API calls inside this callback can deadlock the client.
          setTimeout(() => {
            if (isMounted) applySupabaseSession(session);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          clearStoredAuthData();
          setUser(null);
          setToken(null);
          setProfileVerified(false);
          verifiedTokenRef.current = null;
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Keep localStorage in sync with the refreshed Supabase access token
          localStorage.setItem('token', session.access_token);
          setToken(session.access_token);
          if (verifiedTokenRef.current) verifiedTokenRef.current = session.access_token;
        }
      });

      unsub = () => subscription?.unsubscribe();
    } else {
      // No Supabase client configured — pure backend JWT flow
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        verifyStoredToken();
      } else {
        setIsLoading(false);
      }
    }

    return () => {
      isMounted = false;
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
    // `userData` came straight from the backend response, so it is authoritative.
    setProfileVerified(true);
    return userData;
  };

  const signup = async (email, password) => {
    // Public signups are always students. The backend enforces this and assigns the role.
    const res = await api.post('/auth/signup', { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    setProfileVerified(true);
    return userData;
  };

  const logout = async () => {
    verifiedTokenRef.current = null;
    setProfileVerified(false);
    await performLogout(supabase, setUser, setToken);
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      // The role can only come from the backend; never merge it from UI-supplied data.
      const safeData = { ...(updatedData || {}) };
      delete safeData.role;
      delete safeData.is_admin;
      const next = { ...prev, ...safeData };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  const forgotPassword = async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  };

  const isAuthenticated = !!token && !!user;
  const resolvedRole = getUserRole(user, isAuthenticated);
  // Until the backend has confirmed the profile, a cached "Admin" is treated as a plain
  // Student, so editing localStorage can never unlock admin UI.
  const currentRole = !profileVerified && resolvedRole === 'Admin' ? 'Student' : resolvedRole;
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
    profileVerified,
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

export { clearStoredAuthData, performLogout, getUserRole, getRoleBadgeStyle, getRoleAccessLevel };
