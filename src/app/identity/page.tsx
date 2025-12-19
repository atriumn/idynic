import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResumeUpload } from "@/components/resume-upload";
import { StoryInput } from "@/components/story-input";
import { IdentityClaimsList } from "@/components/identity-claims-list";
import { FileText } from "lucide-react";

export default async function IdentityPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch identity claims with evidence and source documents
  const { data: claims, error: claimsError } = await supabase
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

  console.log("[identity] Claims query:", { count: claims?.length, error: claimsError });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Your Identity</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr,2fr]">
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Upload Resume</h2>
            <ResumeUpload />
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Share a Story</h2>
            <StoryInput />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            Synthesized Claims ({claims?.length || 0})
          </h2>
          {claims && claims.length > 0 ? (
            <IdentityClaimsList claims={claims} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No claims yet</p>
              <p className="text-sm text-muted-foreground/70">
                Upload a resume or share a story to build your identity.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
