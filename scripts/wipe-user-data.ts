#!/usr/bin/env npx tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

async function wipe() {
  const { data: profiles } = await supabase.from("profiles").select("id");
  if (!profiles || profiles.length === 0) {
    console.log("No users found");
    return;
  }

  const userId = profiles[0].id;
  console.log("Wiping data for user:", userId);

  // Delete in order (respecting foreign keys)
  let r;
  r = await supabase.from("matches").delete().eq("user_id", userId);
  console.log("Deleted matches:", r.error ? r.error.message : "OK");

  r = await supabase.from("claims").delete().eq("user_id", userId);
  console.log("Deleted claims:", r.error ? r.error.message : "OK");

  r = await supabase.from("claim_evidence").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleted claim_evidence:", r.error ? r.error.message : "OK");

  r = await supabase.from("identity_claims").delete().eq("user_id", userId);
  console.log("Deleted identity_claims:", r.error ? r.error.message : "OK");

  r = await supabase.from("evidence").delete().eq("user_id", userId);
  console.log("Deleted evidence:", r.error ? r.error.message : "OK");

  r = await supabase.from("documents").delete().eq("user_id", userId);
  console.log("Deleted documents:", r.error ? r.error.message : "OK");

  console.log("Done!");
}

wipe();
