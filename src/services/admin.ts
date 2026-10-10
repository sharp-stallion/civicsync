import { supabase } from '../lib/supabase';
export { getDepartments } from './projects';

export async function approveOfficialHelper(userId: string, departmentId: string, approve: boolean) {
  const { error } = await supabase.rpc('approve_official', {
    p_user_id: userId,
    p_department_id: departmentId || null,
    p_approval: approve ? 'approved' : 'rejected',
  });
  if (error) throw error;
}
