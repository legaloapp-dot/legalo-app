import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/profile';
import { refreshLawyerSubscriptionIfExpired } from '../lib/subscription';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  profile: null,
  profileLoading: true,
  refreshProfile: async () => {},
});

const SESSION_TIMEOUT_MS = 10_000;

function getSessionWithTimeout() {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('getSession timeout')), SESSION_TIMEOUT_MS)
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    let s: Session | null = null;
    try {
      const { data } = await getSessionWithTimeout();
      s = data.session;
    } catch (e) {
      console.warn('[auth] refreshProfile getSession', e instanceof Error ? e.message : e);
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    if (!s?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);

    const FETCH_MS = 15_000;
    let data;
    let error;
    try {
      const result = await Promise.race([
        supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), FETCH_MS)
        ),
      ]);
      data = result.data;
      error = result.error;
    } catch (e) {
      console.warn('[auth] refreshProfile', e instanceof Error ? e.message : e);
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    if (error || !data) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let next = data as Profile;
    if (next.role === 'lawyer') {
      try {
        await refreshLawyerSubscriptionIfExpired();
        const { data: again } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', s.user.id)
          .maybeSingle();
        if (again) next = again as Profile;
      } catch {
        /* RPC opcional si la migración aún no está aplicada */
      }
    }
    setProfile(next);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    void getSessionWithTimeout()
      .then(({ data: { session: s } }) => {
        setSession(s);
      })
      .catch((e) => {
        console.warn('[auth] getSession', e instanceof Error ? e.message : e);
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    refreshProfile();
  }, [session?.user?.id, refreshProfile]);

  return (
    <AuthContext.Provider value={{ session, loading, profile, profileLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
