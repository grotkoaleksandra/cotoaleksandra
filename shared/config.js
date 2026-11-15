// Supabase project settings, with no dependencies, so plain pages (like the
// desktop) can read them without loading supabase-js. shared/supabase.js
// builds the one client from these.
//
// Both values are public by design: the anon key only does what Row-Level
// Security allows. (Legacy JWT anon key: the pinned supabase-js 2.39.3 wants
// that form, not sb_publishable_….)
export const SUPABASE_URL = 'https://vnkwdfbwplgkcjgvvixp.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZua3dkZmJ3cGxna2NqZ3Z2aXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTQ3NDcsImV4cCI6MjEwNTU5MDc0N30.ochfjmYWe2bKmjogfmW7WPTGGxWwrgYZN9KW-5Sff4k';
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
