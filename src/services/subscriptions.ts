import { supabase } from '../lib/supabase';
import type { AreaSubscription } from '../lib/types';

export async function getMySubscriptions(): Promise<AreaSubscription[]> {
  const { data, error } = await supabase.from('area_subscriptions').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AreaSubscription[];
}

export async function addSubscription(input: { label: string; latitude: number; longitude: number; radius_m: number }): Promise<AreaSubscription> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to save an area.');
  const { data, error } = await supabase.from('area_subscriptions').insert({ ...input, user_id: user.id }).select('*').single();
  if (error) throw error;
  return data as AreaSubscription;
}

export async function removeSubscription(id: string) {
  const { error } = await supabase.from('area_subscriptions').delete().eq('id', id);
  if (error) throw error;
}
