import { supabase } from '../lib/supabase';
import type { ProjectStatus, ProjectUpdate } from '../lib/types';

export interface UpdateInput {
  projectId: string;
  status: ProjectStatus;
  progressPercent: number;
  progressNote: string;
  delayReason?: string | null;
  revisedEndDate?: string | null;
}

export async function getProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const { data, error } = await supabase
    .from('project_updates')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectUpdate[];
}

export async function publishUpdate(input: UpdateInput): Promise<ProjectUpdate> {
  const note = input.progressNote.trim();
  if (note.length < 3) throw new Error('Add a short progress note.');
  if (input.status === 'delayed' && !input.delayReason?.trim())
    throw new Error('A delay needs a reason — residents deserve to know why.');
  if (input.status === 'completed' && input.progressPercent !== 100)
    throw new Error('A completed project must be at 100%.');
  const row = {
    project_id: input.projectId,
    status: input.status,
    progress_percent: input.progressPercent,
    progress_note: note,
    delay_reason: input.delayReason?.trim() || null,
    revised_end_date: input.revisedEndDate || null,
  };
  const { data, error } = await supabase.from('project_updates').insert(row).select('*').single();
  if (error) throw error;
  return data as ProjectUpdate;
}
