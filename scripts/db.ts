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
