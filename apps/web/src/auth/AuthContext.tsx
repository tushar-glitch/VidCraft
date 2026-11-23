import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LoginRequest, RegisterRequest, UserDto } from '@vidcraft/shared';
import { api } from '../lib/api.ts';

type AuthModalMode = 'signin' | 'signup';

interface AuthState {
  user: UserDto | null;
  /** True until the first "who am I" check finishes. */
  loading: boolean;
  login(body: LoginRequest): Promise<void>;
  register(body: RegisterRequest): Promise<void>;
  logout(): Promise<void>;
  /** Which auth modal is open, if any. Lives here so any page can ask the user to sign in. */
  modal: AuthModalMode | null;
  openModal(mode: AuthModalMode): void;
  closeModal(): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<AuthModalMode | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (body: LoginRequest) => setUser(await api.login(body)), []);
  const register = useCallback(async (body: RegisterRequest) => setUser(await api.register(body)), []);
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, modal, openModal: setModal, closeModal: () => setModal(null) }),
    [user, loading, login, register, logout, modal],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
