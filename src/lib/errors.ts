// Turn anything thrown (Error, Supabase/PostgREST error object, string) into a
// readable message. Supabase errors are plain objects, not Error instances, so
// `String(e)` on them yields the useless "[object Object]".
export function toMessage(e: unknown): string {
  if (e == null) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const msg = (o.message ?? o.error_description ?? o.error ?? o.details ?? o.hint) as string | undefined;
    if (msg) return String(msg) + (o.code ? ` (${String(o.code)})` : '');
  }
  try { return JSON.stringify(e); } catch { return 'Unexpected error'; }
}
