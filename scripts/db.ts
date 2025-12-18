#!/usr/bin/env npx tsx
/**
 * Simple DB query script. Usage:
 *   npx tsx scripts/db.ts "SELECT count(*) FROM claims"
 *   npx tsx scripts/db.ts "SELECT id, claim_type FROM claims LIMIT 3"
 */
import { createClient } from "@supabase/supabase-js";

const sql = process.argv[2];
if (!sql) {
  console.error("Usage: npx tsx scripts/db.ts <sql>");
  process.exit(1);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rqknwvbdomkcbejcxsqz.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

  // Special commands
  if (sql === "skills") {
    const { data } = await supabase.from("evidence").select("text").eq("evidence_type", "skill_listed");
    console.log("Skill evidence extracted:");
    data?.forEach(e => console.log("-", e.text));
    return;
  }

  if (sql === "claims") {
    const { data } = await supabase.from("identity_claims").select("type, label, confidence");
    console.log("Identity claims:");
    data?.forEach(c => console.log(`[${c.type}] ${c.label} (${(c.confidence * 100).toFixed(0)}%)`));
    return;
  }

  if (sql === "verify") {
    // Evidence counts by type
    const { data: evidence } = await supabase.from("evidence").select("evidence_type");
    const evCounts: Record<string, number> = {};
    evidence?.forEach(e => { evCounts[e.evidence_type] = (evCounts[e.evidence_type] || 0) + 1; });
    console.log("Evidence counts:", evCounts);

    // Claims counts by type
    const { data: claims } = await supabase.from("identity_claims").select("type, label");
    const claimCounts: Record<string, number> = {};
    claims?.forEach(c => { claimCounts[c.type] = (claimCounts[c.type] || 0) + 1; });
    console.log("Claim counts:", claimCounts);

    // Claim-evidence links
    const { count: linkCount } = await supabase.from("claim_evidence").select("*", { count: "exact", head: true });
    console.log("Claim-evidence links:", linkCount);

    // Sample: a claim with multiple evidence
    const { data: claimsWithEvidence } = await supabase
      .from("identity_claims")
      .select("id, label, confidence")
      .gte("confidence", 0.8)
      .limit(3);

    console.log("\nHigh-confidence claims (evidence corroboration):");
    for (const claim of claimsWithEvidence || []) {
      const { data: links } = await supabase
        .from("claim_evidence")
        .select("strength, evidence:evidence_id(text)")
        .eq("claim_id", claim.id);
      console.log(`\n  ${claim.label} (${(claim.confidence * 100).toFixed(0)}%):`);
      links?.forEach(l => {
        const ev = l.evidence as unknown as { text: string } | null;
        console.log(`    - [${l.strength}] ${ev?.text?.slice(0, 60)}...`);
      });
    }

    // Check for duplicate labels
    const labels = claims?.map(c => c.label) || [];
    const seen = new Set<string>();
    const dupes: string[] = [];
    labels.forEach(l => { if (seen.has(l)) dupes.push(l); seen.add(l); });
    if (dupes.length) console.log("\nDuplicate labels found:", Array.from(new Set(dupes)));

    return;
  }

  const { data, error } = await supabase.rpc("exec_sql", { sql });

  if (error) {
    // Fallback: try direct table query if it's a simple select
    const match = sql.match(/from\s+(\w+)/i);
    if (match) {
      const table = match[1];
      const { data: tableData, error: tableError, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .limit(10);

      if (!tableError) {
        console.log(`Count: ${count}`);
        console.log(JSON.stringify(tableData, null, 2));
        return;
      }
    }
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main();
