import { supabase } from '../lib/supabase';
import type { ProjectConflict, ConflictStatus, DashboardStats } from '../lib/types';

export interface ConflictFilters {
  status?: ConflictStatus | '';
  projectId?: string;
  currentOnly?: boolean;
}

export async function getConflicts(filters: ConflictFilters = {}): Promise<ProjectConflict[]> {
  let q = supabase.from('project_conflicts').select('*').order('created_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.currentOnly) q = q.eq('is_current', true);
  if (filters.projectId) q = q.or(`project_a_id.eq.${filters.projectId},project_b_id.eq.${filters.projectId}`);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as ProjectConflict[];
}

export async function resolveConflict(conflictId: string, status: Extract<ConflictStatus, 'coordinating' | 'resolved' | 'dismissed'>, note: string) {
  const { error } = await supabase.rpc('resolve_project_conflict', {
    p_conflict_id: conflictId, p_status: status, p_resolution_note: note.trim(),
  });
  if (error) throw error;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw error;
  const row = (data as DashboardStats[])?.[0];
  return row ?? { total_projects: 0, active_projects: 0, completed_projects: 0, open_reports: 0, open_conflicts: 0, repeat_digs_prevented: 0 };
}
