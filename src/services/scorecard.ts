import { supabase } from '../lib/supabase';
import type { ScorecardRow } from '../lib/types';

export async function getScorecard(): Promise<ScorecardRow[]> {
  const { data, error } = await supabase.from('department_scorecard').select('*');
  if (error) throw error;
  return (data ?? []) as ScorecardRow[];
}
