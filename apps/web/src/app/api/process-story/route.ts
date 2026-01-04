import { getApiUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createHash } from "crypto";
import { log } from "@/lib/logger";
import { withRequestContext, setContextUserId } from "@/lib/api/with-context";
import { inngest } from "@/inngest";

export const maxDuration = 300;

function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export const POST = withRequestContext(async (request: Request) => {
  const serviceSupabase = createServiceRoleClient();

  // Check auth (supports both cookies for web and Bearer token for mobile)
  const user = await getApiUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set user in context for logging
  setContextUserId(user.id);

  // Get text from JSON body
  const body = await request.json();
  const text = body.text as string | undefined;

  if (!text || typeof text !== "string") {
    return Response.json({ error: "No story text provided" }, { status: 400 });
  }

  if (text.length < 200) {
    return Response.json(
      { error: "Story must be at least 200 characters" },
      { status: 400 },
    );
  }

  if (text.length > 10000) {
    return Response.json(
      { error: "Story must be less than 10,000 characters" },
      { status: 400 },
    );
  }

  log.info("Processing story submission", { textLength: text.length });

  // Create job record
  const contentHash = computeContentHash(text);
  const { data: job, error: jobError } = await serviceSupabase
    .from("document_jobs")
    .insert({
      user_id: user.id,
      job_type: "story",
      content_hash: contentHash,
      status: "pending",
    })
    .select()
    .single();

  if (jobError || !job) {
    log.error("Failed to create job", { error: jobError?.message });
    return Response.json({ error: "Failed to create job" }, { status: 500 });
  }

  log.info("Created job, triggering Inngest", { jobId: job.id });

  // Trigger Inngest function for durable processing
  await inngest.send({
    name: "story/process",
    data: {
      jobId: job.id,
      userId: user.id,
      text,
      contentHash,
    },
  });

  // Return immediately with job ID
  return Response.json({ jobId: job.id });
});
