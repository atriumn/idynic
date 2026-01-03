import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { DocumentDetailClient } from "@/components/document-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify document exists and belongs to user
  const { data: document } = await supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!document) {
    notFound();
  }

  return <DocumentDetailClient documentId={id} />;
}
