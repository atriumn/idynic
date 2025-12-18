import { createClient } from "@/lib/supabase/server";
import { ResumeUpload } from "@/components/resume-upload";
import { ClaimsList } from "@/components/claims-list";

export default async function IdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // User should always exist due to middleware protection
  if (!user) {
    return null;
  }

  // Fetch user's claims
  const { data: claims } = await supabase
    .from("claims")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Fetch user's documents
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const hasResume = documents && documents.length > 0;
  const hasClaims = claims && claims.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Your Identity</h1>
      <p className="text-muted-foreground mb-8">
        Your professional profile extracted from your resume
      </p>

      {!hasResume && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Upload Your Resume</h2>
          <ResumeUpload />
        </div>
      )}

      {hasResume && !hasClaims && (
        <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Your resume has been uploaded but no claims were extracted. This may
            happen if the PDF couldn&apos;t be parsed properly. Try uploading a
            different version.
          </p>
        </div>
      )}

      {hasClaims && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Extracted Profile ({claims.length} claims)
            </h2>
            <ResumeUploadButton />
          </div>
          <ClaimsList claims={claims} />
        </div>
      )}

      {hasResume && (
        <div className="mt-8 pt-8 border-t">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Documents
          </h3>
          <ul className="text-sm space-y-1">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2">
                <span className="text-muted-foreground">📄</span>
                <span>{doc.filename}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    doc.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : doc.status === "processing"
                        ? "bg-blue-100 text-blue-800"
                        : doc.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResumeUploadButton() {
  return (
    <div className="text-sm text-muted-foreground">
      <label className="cursor-pointer hover:text-foreground transition-colors">
        Upload new resume
        <input
          type="file"
          className="hidden"
          accept=".pdf,application/pdf"
          // Note: This needs client-side handling - we'll improve this later
        />
      </label>
    </div>
  );
}
