// keepalive — pinged every 2 days by .github/workflows/keepalive.yml.
// Free Supabase projects pause after a week without database activity; this
// runs one tiny real query so the project never counts as idle. If it fails,
// the GitHub workflow fails and GitHub emails Ola.
// JWT verification off: it returns nothing private, only "ok".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase
    .from("contact_submissions")
    .select("id", { count: "exact", head: true });

  return new Response(JSON.stringify({ ok: !error, at: new Date().toISOString() }), {
    status: error ? 500 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
