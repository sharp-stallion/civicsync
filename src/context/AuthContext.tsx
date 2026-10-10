import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentProfile } from '../services/auth';
import type { Profile } from '../lib/types';

interface AuthState {
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState>({ userId: null, email: null, profile: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      setProfile(user ? await getCurrentProfile() : null);
    } catch {
      setUserId(null); setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  return <Ctx.Provider value={{ userId, email, profile, loading, refresh: load }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const isStaff = (p: Profile | null): boolean =>
  !!p && (p.role === 'admin' || (p.role === 'official' && p.approval_status === 'approved'));

// A "verified resident" (completed profile with an area) may post/vote/comment.
export const isVerifiedResident = (p: Profile | null): boolean =>
  !!p && p.approval_status === 'approved' && !!p.home_area && p.home_area.trim().length > 0;

export const canManageDept = (p: Profile | null, departmentId: string): boolean =>
  !!p && (p.role === 'admin' || (p.role === 'official' && p.approval_status === 'approved' && p.department_id === departmentId));
