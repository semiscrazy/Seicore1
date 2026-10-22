import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler } from './api';
import { browserTimezone } from './dates';

export interface User {
  id: number;
  email: string;
  name: string;
  timezone: string;
  reminderTime: string;
  remindersEnabled: boolean;
}

interface AuthState {
  user: User | null | undefined; // undefined while loading
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api<{ user: User }>('/me')
      .then(async ({ user }) => {
        // Keep the server's notion of "today" in step with wherever you are.
        const tz = browserTimezone();
        if (user.timezone !== tz) user = (await api<{ user: User }>('/me', { method: 'PATCH', body: { timezone: tz } }).catch(() => ({ user }))).user;
        setUser(user);
      })
      .catch(() => setUser(null));
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
