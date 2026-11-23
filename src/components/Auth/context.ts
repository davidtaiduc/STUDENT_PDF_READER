import { createContext, useContext } from 'react';
import type { AccountUser } from '../../../shared/types/account';
export interface AuthContextValue {
  user: AccountUser | null; status: 'checking' | 'ready' | 'unavailable'; error: string;
  refresh: () => Promise<void>;
  setAccount: (user: AccountUser | null) => void;
  submit: (action: 'login' | 'register' | 'logout', input?: object) => Promise<void>;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() { const auth = useContext(AuthContext); if (!auth) throw new Error('Thiếu AuthProvider'); return auth; }
