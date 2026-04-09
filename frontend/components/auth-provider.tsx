"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthResponse, RegisterInput, UserProfile } from "@/types/erp";
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  fetchCurrentUser,
  loginUser,
  registerUser
} from "@/lib/api";

type AuthResult = {
  ok: boolean;
  message?: string;
};

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const storedUser = window.localStorage.getItem(AUTH_USER_KEY);

    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as UserProfile);
      } catch {
        window.localStorage.removeItem(AUTH_USER_KEY);
      }
    }

    void fetchCurrentUser(storedToken)
      .then((freshUser) => {
        setUser(freshUser);
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(freshUser));
      })
      .catch(() => {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(AUTH_USER_KEY);
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  function persistAuth(payload: AuthResponse) {
    setToken(payload.token);
    setUser(payload.user);
    window.localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
  }

  async function login(email: string, password: string): Promise<AuthResult> {
    try {
      const payload = await loginUser(email, password);
      persistAuth(payload);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error)
      };
    }
  }

  async function register(input: RegisterInput): Promise<AuthResult> {
    try {
      const payload = await registerUser(input);
      persistAuth(payload);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: getErrorMessage(error)
      };
    }
  }

  async function refreshUser() {
    if (!token) {
      return;
    }

    const freshUser = await fetchCurrentUser(token);
    setUser(freshUser);
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(freshUser));
  }

  function logout() {
    setUser(null);
    setToken(null);
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
