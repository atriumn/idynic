import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResumeUpload } from "@/components/resume-upload";
import { IdentityClaimsList } from "@/components/identity-claims-list";

export default async function IdentityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch identity claims with evidence and source documents
  const { data: claims } = await supabase
    .from("identity_claims")
    .select(`
      *,
      claim_evidence(
        strength,
        evidence:evidence_id(
          text,
          document:document_id(
            filename
          )
        )
      )
    `)
    .eq("user_id", user.id)
    .order("confidence", { ascending: false });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Your Identity</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold mb-4">Upload Resume</h2>
          <ResumeUpload />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Synthesized Claims ({claims?.length || 0})
          </h2>
          {claims && claims.length > 0 ? (
            <IdentityClaimsList claims={claims} />
          ) : (
            <p className="text-muted-foreground">
              Upload a resume to build your identity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
