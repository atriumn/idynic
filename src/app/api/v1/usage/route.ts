import { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { validateApiKey, isAuthError } from "@/lib/api/auth";
import { apiSuccess } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request);
  if (isAuthError(authResult)) {
    return authResult;
  }

  const { userId } = authResult;
  const supabase = createServiceRoleClient();

  // Get API key stats
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, last_used_at, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // Get document counts
  const { count: documentCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get opportunity counts
  const { count: opportunityCount } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Get share link counts
  const { count: shareLinkCount } = await supabase
    .from("shared_links")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null);

  return apiSuccess({
    api_keys: keys?.map((k) => ({
      prefix: k.key_prefix,
      name: k.name,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    })),
    counts: {
      documents: documentCount || 0,
      opportunities: opportunityCount || 0,
      active_share_links: shareLinkCount || 0,
    },
  });
}
