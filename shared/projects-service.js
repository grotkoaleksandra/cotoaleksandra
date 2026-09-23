// The work list. Reads the `projects` table when Supabase is connected;
// otherwise the page keeps the placeholder rows already written in index.html.
import { supabase, CONFIGURED } from './supabase.js';

/** Published projects in display order, or null when there's nothing to swap in. */
export async function loadProjects() {
  if (!CONFIGURED) return null;
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('name, name_em, meta, url, sort_order')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data?.length ? data : null;
  } catch (err) {
    console.warn('[projects] keeping the static list:', err.message);
    return null;
  }
}
