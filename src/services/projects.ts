import { supabase } from '../lib/supabase';
import type { Department, Project, ProjectStatus, WorkType, NearbyProject } from '../lib/types';

export interface ProjectFilters {
  search?: string;
  status?: ProjectStatus | '';
  workType?: WorkType | '';
  departmentId?: string;
  limit?: number;
}

const SELECT = '*, department:departments(id,name)';

export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Department[];
}

export async function getProjects(filters: ProjectFilters = {}): Promise<Project[]> {
  let q = supabase.from('projects').select(SELECT).order('start_date', { ascending: false });
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[,%()*]/g, ' ');
    q = q.or(`title.ilike.%${term}%,road_name.ilike.%${term}%,location_description.ilike.%${term}%`);
  }
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.workType) q = q.eq('work_type', filters.workType);
  if (filters.departmentId) q = q.eq('department_id', filters.departmentId);
  q = q.limit(Math.min(Math.max(filters.limit ?? 100, 1), 500));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from('projects').select(SELECT).eq('id', id).single();
  if (error) throw error;
  return data as Project;
}

export async function getProjectsByIds(ids: string[]): Promise<Project[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return [];
  const { data, error } = await supabase.from('projects').select(SELECT).in('id', unique);
  if (error) throw error;
  return (data ?? []) as Project[];
}

export type ProjectDraft = Omit<Project, 'id' | 'version' | 'created_at' | 'updated_at' | 'department' | 'actual_end_date' | 'progress_percent'> & {
  progress_percent?: number;
};

export async function createProject(input: ProjectDraft): Promise<Project> {
  validate(input);
  const { data, error } = await supabase.from('projects').insert(input).select(SELECT).single();
  if (error) throw error;
  return data as Project;
}

export type ProjectEdit = Partial<Pick<Project,
  'title' | 'description' | 'road_name' | 'road_segment_id' | 'location_description' |
  'latitude' | 'longitude' | 'segment_end_latitude' | 'segment_end_longitude' |
  'work_type' | 'department_id' | 'start_date' | 'end_date' | 'contractor_name' | 'estimated_cost_inr'>>;

export async function updateProjectDetails(id: string, changes: ProjectEdit): Promise<Project> {
  if (!id || !Object.keys(changes).length) throw new Error('Nothing to update.');
  if (changes.start_date && changes.end_date && changes.end_date < changes.start_date)
    throw new Error('End date cannot be before start date.');
  const { data, error } = await supabase.from('projects').update(changes).eq('id', id).select(SELECT).single();
  if (error) throw error;
  return data as Project;
}

export async function recheckConflicts(projectId: string): Promise<number> {
  const { data, error } = await supabase.rpc('recheck_project_conflicts', { p_project_id: projectId });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function projectsNear(lat: number, lng: number, radiusM = 800): Promise<NearbyProject[]> {
  const { data, error } = await supabase.rpc('projects_near', { p_lat: lat, p_lng: lng, p_radius_m: radiusM });
  if (error) throw error;
  return (data ?? []) as NearbyProject[];
}

function validate(p: ProjectDraft) {
  if (!p.title?.trim() || !p.road_name?.trim() || !p.department_id) throw new Error('Title, road and department are required.');
  if (!(p.latitude >= -90 && p.latitude <= 90) || !(p.longitude >= -180 && p.longitude <= 180))
    throw new Error('A valid map location is required — click the map to place the work.');
  if (!p.start_date || !p.end_date) throw new Error('Start and end dates are required.');
  if (p.end_date < p.start_date) throw new Error('End date cannot be before start date.');
}
