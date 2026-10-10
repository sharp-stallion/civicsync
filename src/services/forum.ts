import { supabase } from '../lib/supabase';
import type { ForumPost, ForumComment, ForumStatus, ForumStats, WorkType } from '../lib/types';

const SELECT = '*, author:profiles!author_id(full_name,home_area)';

export interface ForumFilters { status?: ForumStatus | ''; area?: string; sort?: 'top' | 'new' }

export async function getPosts(f: ForumFilters = {}): Promise<ForumPost[]> {
  let q = supabase.from('forum_posts').select(SELECT);
  if (f.status) q = q.eq('status', f.status);
  else q = q.in('status', ['approved', 'converted']); // public board shows approved
  if (f.area) q = q.ilike('area', `%${f.area}%`);
  q = f.sort === 'new'
    ? q.order('created_at', { ascending: false })
    : q.order('score', { ascending: false }).order('created_at', { ascending: false });
  const { data, error } = await q.limit(100);
  if (error) throw error;
  return (data ?? []) as ForumPost[];
}

// Pending queue for moderators (RLS returns pending only to staff).
export async function getPendingPosts(): Promise<ForumPost[]> {
  const { data, error } = await supabase.from('forum_posts').select(SELECT).eq('status', 'pending').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ForumPost[];
}

export async function getPost(id: string): Promise<ForumPost> {
  const { data, error } = await supabase.from('forum_posts').select(SELECT).eq('id', id).single();
  if (error) throw error;
  return data as ForumPost;
}

export interface NewDemand { title: string; body: string; end_goal: string; area: string; work_type?: WorkType | null; latitude?: number | null; longitude?: number | null; image_path?: string | null }

// Demand photos live in a PUBLIC bucket (demands are public). Upload is
// owner-scoped by the storage policy; the returned path is stored on the post.
export async function uploadDemandPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPEG, PNG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to add an image.');
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `demands/${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('civic-demand-photos').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

export function demandPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from('civic-demand-photos').getPublicUrl(path).data.publicUrl;
}

export async function createDemand(input: NewDemand): Promise<ForumPost> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to raise a demand.');
  const row = {
    author_id: user.id,
    title: input.title.trim(),
    body: input.body.trim(),
    end_goal: input.end_goal.trim(),
    area: input.area.trim(),
    work_type: input.work_type ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    image_path: input.image_path ?? null,
  };
  const { data, error } = await supabase.from('forum_posts').insert(row).select(SELECT).single();
  if (error) throw error;
  return data as ForumPost;
}

export async function castVote(postId: string, value: -1 | 0 | 1) {
  const { error } = await supabase.rpc('cast_forum_vote', { p_post_id: postId, p_value: value });
  if (error) throw error;
}

// The current user's own votes, so the UI can highlight their choice.
export async function getMyVotes(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('forum_votes').select('post_id,value');
  if (error) return {};
  const map: Record<string, number> = {};
  for (const v of data ?? []) map[(v as { post_id: string }).post_id] = (v as { value: number }).value;
  return map;
}

export async function moderatePost(postId: string, status: Extract<ForumStatus, 'approved' | 'rejected'>) {
  const { error } = await supabase.rpc('moderate_forum_post', { p_post_id: postId, p_status: status });
  if (error) throw error;
}

export async function linkDemandToProject(postId: string, projectId: string) {
  const { error } = await supabase.rpc('link_demand_to_project', { p_post_id: postId, p_project_id: projectId });
  if (error) throw error;
}

export async function getComments(postId: string): Promise<ForumComment[]> {
  const { data, error } = await supabase.from('forum_comments')
    .select('*, author:profiles!author_id(full_name)')
    .eq('post_id', postId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ForumComment[];
}

export async function addComment(postId: string, body: string): Promise<ForumComment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to comment.');
  const { data, error } = await supabase.from('forum_comments')
    .insert({ post_id: postId, author_id: user.id, body: body.trim() })
    .select('*, author:profiles!author_id(full_name)').single();
  if (error) throw error;
  return data as ForumComment;
}

// How many demands the current resident has raised today (IST). The server
// also enforces the cap of 2/day via RLS — this is just for friendly UI.
export async function myDemandsToday(): Promise<number> {
  const { data, error } = await supabase.rpc('my_demands_today');
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function getForumStats(): Promise<ForumStats> {
  const { data, error } = await supabase.rpc('get_forum_stats');
  if (error) throw error;
  return (data as ForumStats[])?.[0] ?? { pending_demands: 0, approved_demands: 0, converted_demands: 0, total_votes: 0 };
}
