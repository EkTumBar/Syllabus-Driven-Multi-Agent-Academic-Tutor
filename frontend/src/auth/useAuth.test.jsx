import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth, clearStoredAuthData } from './useAuth';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient', () => {
  const mockSignOut = vi.fn().mockResolvedValue({ error: null });
  const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
  const mockOnAuthStateChange = vi.fn().mockReturnValue({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  });

  return {
    supabase: {
      auth: {
        signOut: mockSignOut,
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
      },
    },
  };
});

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { id: 'user-123', email: 'user@example.com' } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe('useAuth - logout and storage purge', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('confirms clearStoredAuthData is defined at module level', () => {
    expect(typeof clearStoredAuthData).toBe('function');
  });

  it('puts token, user, and sb-test-auth-token in localStorage, calls logout(), and asserts complete purge and null state', async () => {
    // 1. Put token, user and an sb-test-auth-token key in localStorage
    localStorage.setItem('token', 'active-access-token');
    localStorage.setItem('user', JSON.stringify({ id: 'user-123', email: 'user@example.com' }));
    localStorage.setItem('sb-test-auth-token', 'mock-supabase-persisted-session');
    localStorage.setItem('sb-test-auth-verifier', 'verifier-data');

    expect(localStorage.getItem('token')).toBe('active-access-token');
    expect(localStorage.getItem('user')).not.toBeNull();
    expect(localStorage.getItem('sb-test-auth-token')).toBe('mock-supabase-persisted-session');

    // 2. Render useAuth hook inside AuthProvider
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider>,
    });

    // Verify initial user and token state populated from localStorage
    expect(result.current.token).toBe('active-access-token');
    expect(result.current.user).toEqual({ id: 'user-123', email: 'user@example.com' });

    // 3. Call logout() and assert that it resolves
    let logoutPromise;
    await act(async () => {
      logoutPromise = result.current.logout();
      await logoutPromise;
    });

    await expect(logoutPromise).resolves.toBeUndefined();

    // 4. Assert signOut was called with { scope: 'local' }
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    // 5. Assert that no token, user, or sb-* keys remain in localStorage
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('sb-test-auth-token')).toBeNull();
    expect(localStorage.getItem('sb-test-auth-verifier')).toBeNull();

    const remainingSbKeys = Object.keys(localStorage).filter((k) => k.startsWith('sb-'));
    expect(remainingSbKeys.length).toBe(0);

    // 6. Assert user and token state are null
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
