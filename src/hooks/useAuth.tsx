import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import axios from 'axios';
import api, { getApiError, setUnauthorizedHandler } from '@/lib/api';

import { parseApiRole, type AppRole } from '@/lib/roles';

export type { AppRole };

// Shape of the user returned by the .NET API (PascalCase JSON).
export interface AuthUser {
  Id: string;
  FullName: string;
  Email: string;
  Role: string;
  AvatarUrl?: string | null;
  /** Extra role assigned by an admin (null when none) and its resolved name. */
  CustomRoleId?: string | null;
  CustomRoleName?: string | null;
  /** Effective permissions right now (base-role defaults + custom role). Absent on sessions saved before RBAC. */
  Permissions?: string[];
  /** True when this account's password was set by someone else (admin/org creation) and must be changed before anything else works. */
  MustChangePassword?: boolean;
}

/** A sign-in/sign-up failure: `message` is user-facing (already translated), `code` is the API's stable error code. */
export type AuthError = Error & { code?: string };

const toAuthError = (error: unknown): AuthError => {
  const authError: AuthError = new Error(getApiError(error));
  const code = axios.isAxiosError(error) ? (error.response?.data as { code?: unknown } | undefined)?.code : undefined;
  if (typeof code === 'string') authError.code = code;
  return authError;
};

interface AuthContextType {
  user: AuthUser | null;
  role: AppRole | null;
  loading: boolean;
  /** Exactly one of joinCode/requestedOrganizationId is required. A join code joins immediately (session created); a
   * requested org submits a request that needs approval first — no session is created, `pending` is true instead. */
  signUp: (
    email: string, password: string, fullName: string,
    joinCode?: string, requestedOrganizationId?: string
  ) => Promise<{ error: AuthError | null; pending?: boolean; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  /** Merges profile changes into the signed-in user (state and stored session). */
  updateUser: (patch: Partial<Pick<AuthUser, 'FullName' | 'AvatarUrl'>>) => void;
  /** Re-reads the user (role, custom role, permissions) from GET /Auth/me so role edits apply without signing in again. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'tareeqelm_token';
const USER_KEY = 'tareeqelm_user';
const EXPIRY_KEY = 'tareeqelm_token_expires';

// Per-user data kept in localStorage must not survive a sign-out on a shared machine.
const USER_SCOPED_PREFIXES = ['chat_history_', 'achievements_'];

const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  Object.keys(localStorage)
    .filter((key) => USER_SCOPED_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .forEach((key) => localStorage.removeItem(key));
};

const isExpired = (expiresAt: string | null) => {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && time <= Date.now();
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((token: string, expiresAt: string | undefined, userData: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (expiresAt) localStorage.setItem(EXPIRY_KEY, expiresAt);
    setUser(userData);
    setRole(parseApiRole(userData.Role));
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
    setUser(null);
    setRole(null);
  }, []);

  const updateUser = useCallback((patch: Partial<Pick<AuthUser, 'FullName' | 'AvatarUrl'>>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    try {
      const response = await api.get<AuthUser>('/Auth/me');
      const fresh = response.data;
      if (!fresh || typeof fresh !== 'object' || !fresh.Id) return;
      if (!localStorage.getItem(TOKEN_KEY)) return; // signed out while the request was in flight
      setUser((current) => {
        if (!current || current.Id !== fresh.Id) return current;
        const next: AuthUser = { ...current, ...fresh, Permissions: Array.isArray(fresh.Permissions) ? fresh.Permissions : [] };
        try { localStorage.setItem(USER_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        return next;
      });
      setRole(parseApiRole(fresh.Role));
    } catch {
      // Offline or rejected: keep the stored session (a 401 is handled by the API interceptor).
    }
  }, []);

  // Restore the session on load, but never trust a token that has already expired.
  useEffect(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);

    if (savedUser && token) {
      if (isExpired(localStorage.getItem(EXPIRY_KEY))) {
        clearSession();
      } else {
        try {
          const userData = JSON.parse(savedUser) as AuthUser;
          setUser(userData);
          setRole(parseApiRole(userData?.Role));
        } catch (e) {
          console.error('Failed to parse saved user', e);
          clearSession();
        }
      }
    }
    setLoading(false);
    if (savedUser && token) void refreshUser();
  }, [refreshUser]);

  // Sign out of React state when the API rejects the token, and when it expires while the app is open.
  useEffect(() => {
    setUnauthorizedHandler(() => { void signOut(); });
    return () => setUnauthorizedHandler(null);
  }, [signOut]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      if (isExpired(localStorage.getItem(EXPIRY_KEY))) void signOut();
    }, 30_000);
    return () => clearInterval(timer);
  }, [user, signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.post('/Auth/login', { Email: email, Password: password });
      const { Token, ExpiresAt, User: userData } = response.data;
      applySession(Token, ExpiresAt, userData);
      return { error: null };
    } catch (error) {
      return { error: toAuthError(error) };
    }
  }, [applySession]);

  // Self-registration always creates a Trainer; the server ignores any role sent by the client.
  const signUp = useCallback(async (
    email: string, password: string, fullName: string,
    joinCode?: string, requestedOrganizationId?: string
  ) => {
    try {
      const response = await api.post('/Auth/register', {
        Email: email,
        Password: password,
        FullName: fullName,
        JoinCode: joinCode || undefined,
        RequestedOrganizationId: requestedOrganizationId || undefined,
      });
      if (response.data?.Pending) {
        return { error: null, pending: true, message: response.data.Message as string | undefined };
      }
      const { Token, ExpiresAt, User: userData } = response.data;
      applySession(Token, ExpiresAt, userData);
      return { error: null };
    } catch (error) {
      return { error: toAuthError(error) };
    }
  }, [applySession]);

  const value = useMemo(
    () => ({ user, role, loading, signUp, signIn, signOut, updateUser, refreshUser }),
    [user, role, loading, signUp, signIn, signOut, updateUser, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
