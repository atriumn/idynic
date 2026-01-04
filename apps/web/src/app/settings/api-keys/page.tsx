import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listApiKeys } from "./actions";
import { ApiKeysClient } from "./client";

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const keys = await listApiKeys();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">API Keys</h1>
        <p className="text-muted-foreground">
          Manage API keys for external access to your Idynic data. Use these
          keys with the Idynic MCP server or REST API.
        </p>
      </div>

      <ApiKeysClient initialKeys={keys} />
    </div>
  );
}
