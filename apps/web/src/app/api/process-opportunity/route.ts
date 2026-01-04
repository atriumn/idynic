import { getApiUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { log } from "@/lib/logger";
import { withRequestContext, setContextUserId } from "@/lib/api/with-context";
import { inngest } from "@/inngest";
import { normalizeJobUrl } from "@/lib/utils/normalize-url";

export const POST = withRequestContext(async (request: Request) => {
  const serviceSupabase = createServiceRoleClient();

  // Check auth (supports both cookies for web and Bearer token for mobile)
  const user = await getApiUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set user in context for logging
  setContextUserId(user.id);

  let body: { url?: string; description?: string };
  try {
    body = await request.json();
  } catch (err) {
    log.error("JSON parsing error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, description } = body;

  if (!url && !description) {
    return Response.json(
      { error: "Either url or description is required" },
      { status: 400 },
    );
  }

  // Quick duplicate check before creating job
  if (url) {
    const normalizedUrl = normalizeJobUrl(url);
    if (normalizedUrl) {
      const { data: existing } = await serviceSupabase
        .from("opportunities")
        .select("id, title, company")
        .eq("user_id", user.id)
        .eq("normalized_url", normalizedUrl)
        .single();

      if (existing) {
        return Response.json(
          {
            error: "You have already saved this job",
            existing: {
              id: existing.id,
              title: existing.title,
              company: existing.company,
            },
          },
          { status: 409 },
        );
      }
    }
  }

  log.info("Processing opportunity", { url, hasDescription: !!description });

  // Create job record
  const { data: job, error: jobError } = await serviceSupabase
    .from("document_jobs")
    .insert({
      user_id: user.id,
      job_type: "opportunity",
      filename: url || "manual entry",
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
    name: "opportunity/process",
    data: {
      jobId: job.id,
      userId: user.id,
      url: url || null,
      description: description || null,
    },
  });

  // Return immediately with job ID
  return Response.json({ jobId: job.id });
});
