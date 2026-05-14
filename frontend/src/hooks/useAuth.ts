import { useState, useCallback } from 'react';
import { api } from '../api/client';

export interface User {
  username: string;
  role: 'admin' | 'user';
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const storedToken = localStorage.getItem('smartdqc_token');
  const [state, setState] = useState<AuthState>({
    user: null,
    token: storedToken,
    isAuthenticated: !!storedToken,
  });

  const login = useCallback(async (username: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', username);
    form.append('password', password);

    const { data } = await api.post<{ access_token: string; token_type: string; role: string }>(
      '/auth/login',
      form,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    localStorage.setItem('smartdqc_token', data.access_token);
    setState({
      token: data.access_token,
      user: { username, role: data.role as 'admin' | 'user' },
      isAuthenticated: true,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('smartdqc_token');
    setState({ user: null, token: null, isAuthenticated: false });
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<{ username: string; role: string }>('/auth/me');
      setState(s => ({
        ...s,
        user: { username: data.username, role: data.role as 'admin' | 'user' },
      }));
    } catch {
      logout();
    }
  }, [logout]);

  return { ...state, login, logout, fetchMe };
}
