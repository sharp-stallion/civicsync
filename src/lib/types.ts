// Mirrors the database vocabulary EXACTLY (see supabase/schema.sql).
// The whole app speaks these strings — no translation layer, no reconciliation.

export const PROJECT_STATUSES = ['planned', 'ongoing', 'delayed', 'completed', 'cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WORK_TYPES = ['road_repair', 'water_pipeline', 'sewer_drainage', 'electricity', 'telecom', 'gas', 'stormwater', 'other'] as const;
export type WorkType = (typeof WORK_TYPES)[number];

export const REPORT_CATEGORIES = ['quality', 'safety', 'delay', 'damage', 'unregistered_work', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CONFLICT_STATUSES = ['open', 'coordinating', 'resolved', 'dismissed', 'cleared'] as const;
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

export type ConflictType = 'schedule_overlap' | 'lookahead_repeat' | 'proximity';
export type Role = 'citizen' | 'official' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Department {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  home_area: string | null;
  phone_verified: boolean;
  role: Role;
  department_id: string | null;
  approval_status: ApprovalStatus;
}

export const FORUM_STATUSES = ['pending', 'approved', 'rejected', 'converted'] as const;
export type ForumStatus = (typeof FORUM_STATUSES)[number];

export interface ForumPost {
  id: string;
  author_id: string;
  title: string;
  body: string;
  end_goal: string;
  area: string;
  work_type: WorkType | null;
  latitude: number | null;
  longitude: number | null;
  status: ForumStatus;
  image_path: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  converted_project_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  author?: { full_name: string | null; home_area: string | null } | null;
}

export interface ForumComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null } | null;
}

export interface ForumStats {
  pending_demands: number;
  approved_demands: number;
  converted_demands: number;
  total_votes: number;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  road_name: string;
  road_segment_id: string | null;
  location_description: string | null;
  latitude: number;
  longitude: number;
  segment_end_latitude: number | null;
  segment_end_longitude: number | null;
  work_type: WorkType;
  department_id: string;
  start_date: string;
  end_date: string;
  actual_end_date: string | null;
  revised_end_date: string | null;
  status: ProjectStatus;
  progress_percent: number;
  contractor_name: string | null;
  estimated_cost_inr: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  department?: { id: string; name: string } | null;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  status: ProjectStatus;
  progress_percent: number;
  progress_note: string;
  delay_reason: string | null;
  revised_end_date: string | null;
  created_at: string;
}

export interface CitizenReport {
  id: string;
  user_id: string;
  project_id: string | null;
  matched_project_id: string | null;
  is_unregistered: boolean;
  latitude: number | null;
  longitude: number | null;
  road_name: string | null;
  category: ReportCategory;
  description: string;
  photo_path: string | null;
  status: ReportStatus;
  official_response: string | null;
  reviewed_at: string | null;
  created_at: string;
  project?: { id: string; title: string; road_name: string; department_id: string } | null;
}

export interface ProjectConflict {
  id: string;
  project_a_id: string;
  project_b_id: string;
  conflict_type: ConflictType;
  reason: string;
  distance_m: number | null;
  status: ConflictStatus;
  resolution_note: string | null;
  reviewed_at: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  open_reports: number;
  open_conflicts: number;
  repeat_digs_prevented: number;
}

export interface ScorecardRow {
  department_id: string;
  department_name: string;
  completed: number;
  active: number;
  overdue: number;
  on_time_pct: number | null;
  avg_delay_days: number | null;
  reports_received: number;
  report_response_pct: number | null;
}

export interface NearbyProject {
  id: string;
  title: string;
  road_name: string;
  work_type: WorkType;
  status: ProjectStatus;
  department_id: string;
  start_date: string;
  end_date: string;
  latitude: number;
  longitude: number;
  distance_m: number;
}

export interface AreaSubscription {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  created_at: string;
}
