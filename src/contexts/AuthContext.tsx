import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface PhoneRegisterData {
  firstName: string;
  lastName: string;
  phone: string;
  pin: string;
  categoryId: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  // Admin (legacy email/password) — unchanged
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Phone+PIN flow for regular users
  signInWithPhone: (phone: string, pin: string) => Promise<void>;
  registerWithPhone: (data: PhoneRegisterData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => setProfile(payload.new as Profile)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const signInWithPhone = async (phone: string, pin: string) => {
    const { data, error } = await supabase.functions.invoke("phone-login", {
      body: { phone, pin },
    });
    if (error) {
      // Try to extract message from the function response body
      const ctx: any = (error as any).context;
      let msg = error.message;
      try {
        if (ctx?.body) {
          const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
          if (parsed?.error) msg = parsed.error;
        }
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.access_token || !data?.refresh_token) throw new Error("Respuesta inválida del servidor.");
    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (setErr) throw setErr;
  };

  const registerWithPhone = async (d: PhoneRegisterData) => {
    const { data, error } = await supabase.functions.invoke("phone-register", { body: d });
    if (error) {
      const ctx: any = (error as any).context;
      let msg = error.message;
      try {
        if (ctx?.body) {
          const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
          if (parsed?.error) msg = parsed.error;
        }
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    // Auto sign-in
    await signInWithPhone(d.phone, d.pin);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signIn, signOut, refreshProfile, signInWithPhone, registerWithPhone }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
