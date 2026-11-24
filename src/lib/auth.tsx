import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { supabase, SESSION_KEY } from "./supabase";
import type { Player, SessionData } from "./types";

interface AuthContextValue {
  player: Player | null;
  token: string | null;
  loading: boolean;
  signUp: (familyName: string, pin: string) => Promise<{ error: string | null }>;
  signIn: (familyName: string, pin: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setPlayer(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const parsed: SessionData = JSON.parse(stored);
      const { data, error } = await supabase.rpc("get_session", {
        p_token: parsed.token,
      });

      if (error || !data || (data as Record<string, unknown>).error) {
        localStorage.removeItem(SESSION_KEY);
        setPlayer(null);
        setToken(null);
        return;
      }

      const sessionData = data as SessionData;
      setPlayer(sessionData.player);
      setToken(sessionData.token);
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ token: sessionData.token, player: sessionData.player })
      );
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setPlayer(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const signUp = async (familyName: string, pin: string) => {
    const { data, error } = await supabase.rpc("signup", {
      p_family_name: familyName,
      p_pin: pin,
    });

    if (error) return { error: "Erro de conexão. Tente novamente." };
    const result = data as Record<string, unknown>;
    if (result.error) return { error: result.error as string };

    const session = result as unknown as SessionData;
    setPlayer(session.player);
    setToken(session.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { error: null };
  };

  const signIn = async (familyName: string, pin: string) => {
    const { data, error } = await supabase.rpc("login", {
      p_family_name: familyName,
      p_pin: pin,
    });

    if (error) return { error: "Erro de conexão. Tente novamente." };
    const result = data as Record<string, unknown>;
    if (result.error) return { error: result.error as string };

    const session = result as unknown as SessionData;
    setPlayer(session.player);
    setToken(session.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { error: null };
  };

  const signOut = async () => {
    if (token) {
      await supabase.rpc("logout", { p_token: token });
    }
    localStorage.removeItem(SESSION_KEY);
    setPlayer(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ player, token, loading, signUp, signIn, signOut, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
