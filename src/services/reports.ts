import { supabase } from '../lib/supabase';
import type { CitizenReport, ReportCategory, ReportStatus } from '../lib/types';

export interface ReportInput {
  projectId?: string | null;
  isUnregistered: boolean;
  latitude?: number | null;
  longitude?: number | null;
  roadName?: string | null;
  category: ReportCategory;
  description: string;
  photoPath?: string | null;
}

// Disambiguate: citizen_reports has two FKs to projects (project_id and
// matched_project_id), so PostgREST needs the exact FK column to embed.
const SELECT = '*, project:projects!project_id(id,title,road_name,department_id)';

export async function uploadReportPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Photo must be 5 MB or smaller.');
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error('Sign in before uploading a photo.');
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `reports/${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('civic-report-photos').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getReportPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('civic-report-photos').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function submitReport(input: ReportInput): Promise<CitizenReport> {
  const description = input.description.trim();
  if (description.length < 10 || description.length > 4000) throw new Error('Describe the issue in 10–4,000 characters.');
  if (!input.isUnregistered && !input.projectId) throw new Error('Choose a project, or switch to reporting unregistered digging.');
  if (input.isUnregistered && (input.latitude == null || input.longitude == null))
    throw new Error('Drop a pin on the map to show where the digging is.');
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  if (!user) throw new Error('Sign in to submit a report.');

  const row = {
    user_id: user.id,
    project_id: input.isUnregistered ? null : input.projectId ?? null,
    is_unregistered: input.isUnregistered,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    road_name: input.roadName ?? null,
    category: input.isUnregistered ? 'unregistered_work' : input.category,
    description,
    photo_path: input.photoPath ?? null,
  };
  const { data, error } = await supabase.from('citizen_reports').insert(row).select(SELECT).single();
  if (error) throw error;
  return data as CitizenReport;
}

export async function getMyReports(): Promise<CitizenReport[]> {
  const { data, error } = await supabase.from('citizen_reports').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CitizenReport[];
}

// Officials' triage inbox. RLS returns only reports this official may see.
export async function getReportsInbox(): Promise<CitizenReport[]> {
  const { data, error } = await supabase
    .from('citizen_reports')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as CitizenReport[];
}

export async function reviewReport(id: string, status: Extract<ReportStatus, 'under_review' | 'resolved' | 'dismissed'>, response?: string) {
  const { error } = await supabase.rpc('review_citizen_report', { p_report_id: id, p_status: status, p_response: response?.trim() || null });
  if (error) throw error;
}

export async function matchReportToProject(reportId: string, projectId: string) {
  const { error } = await supabase.rpc('match_report_to_project', { p_report_id: reportId, p_project_id: projectId });
  if (error) throw error;
}
