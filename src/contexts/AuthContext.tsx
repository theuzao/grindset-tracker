import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  authSignIn,
  authSignOut,
  authSignUp,
  getSession,
  onAuthStateChange,
  type Session,
  type User,
} from '@/services/supabaseClient';
import { initializeSyncManager } from '@/database/multiDeviceSync';
import { isSupabaseAvailable } from '@/services/supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseAvailable();

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Restaurar sessão existente
    getSession().then(({ session }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initializeSyncManager(session.user.id);
      }
      setLoading(false);
    });

    // Escutar mudanças de auth
    const unsubscribe = onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        initializeSyncManager(session.user.id);
      }
    });

    return unsubscribe;
  }, [isConfigured]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await authSignIn(email, password);
      return { error };
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { error } = await authSignUp(email, password);
      return { error };
    },
    []
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, isConfigured, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
