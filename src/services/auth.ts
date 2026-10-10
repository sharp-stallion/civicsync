import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

export async function signUpWithEmail(email: string, password: string, fullName: string, homeArea: string) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, home_area: homeArea }, emailRedirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  });
  if (error) throw error;
}

// Residents set their own name + Chennai area (completing the profile unlocks
// posting/voting on the Demand Board). phone_verified is never client-writable.
export async function updateMyProfile(fullName: string, homeArea: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await supabase.from('profiles')
    .update({ full_name: fullName.trim(), home_area: homeArea.trim() })
    .eq('id', user.id);
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function requestOfficialAccess(departmentId: string) {
  const { error } = await supabase.rpc('request_official_access', { p_department_id: departmentId });
  if (error) throw error;
}

export async function approveOfficial(userId: string, departmentId: string) {
  const { error } = await supabase.rpc('approve_official', { p_user_id: userId, p_department_id: departmentId });
  if (error) throw error;
}
