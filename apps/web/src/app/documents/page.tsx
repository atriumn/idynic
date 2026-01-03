import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentsPageClient } from "@/components/documents-page-client";

export default async function DocumentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <DocumentsPageClient />;
}
