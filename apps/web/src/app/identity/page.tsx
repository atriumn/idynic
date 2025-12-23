import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IdentityPageClient } from "@/components/identity-page-client";

export default async function IdentityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has any claims (for empty state)
  const { count } = await supabase
    .from("identity_claims")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return <IdentityPageClient hasAnyClaims={(count ?? 0) > 0} />;
}
