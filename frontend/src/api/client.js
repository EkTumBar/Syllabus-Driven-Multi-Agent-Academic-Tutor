import axios from 'axios';
import { supabase } from '../supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 180s (3 min) timeout to accommodate multi-module LLM planning and question generation
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle token expiration / auth errors and timeouts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.message = 'The request timed out while generating course modules and questions with the AI tutor. Please try again.';
    }
    if (error.response && error.response.status === 401) {
      // Before clearing credentials, check if a valid Supabase session exists.
      // If it does, the backend user will be auto-provisioned on the next call —
      // do NOT clear the Supabase access token.
      let hasSupabaseSession = false;
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          hasSupabaseSession = !!session;
        } catch (_) {
          // ignore
        }
      }
      if (!hasSupabaseSession) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;

