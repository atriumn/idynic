import { getApiUser } from "@/lib/supabase/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { log } from "@/lib/logger";
import { withRequestContext, setContextUserId } from "@/lib/api/with-context";
import { inngest } from "@/inngest";
import {
  checkUploadLimit,
  incrementUploadCount,
} from "@/lib/billing/check-usage";

// Vercel Pro plan allows up to 300 seconds (5 min)
export const maxDuration = 300;

export const POST = withRequestContext(async (request: Request) => {
  const serviceSupabase = createServiceRoleClient();

  // Check auth (supports both cookies for web and Bearer token for mobile)
  const user = await getApiUser(request);

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Set user in context for logging
  setContextUserId(user.id);

  // Check upload limit
  const usageCheck = await checkUploadLimit(serviceSupabase, user.id);
  if (!usageCheck.allowed) {
    log.info("Upload limit reached", {
      userId: user.id,
      current: usageCheck.current,
      limit: usageCheck.limit,
    });
    return Response.json(
      {
        error: "upload_limit_reached",
        message: usageCheck.reason,
        current: usageCheck.current,
        limit: usageCheck.limit,
        planType: usageCheck.planType,
      },
      { status: 403 },
    );
  }

  // Get file from form data
  let formData: globalThis.FormData;
  try {
    formData = (await request.formData()) as unknown as globalThis.FormData;
  } catch (err) {
    log.error("FormData parsing error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return Response.json(
      { error: "Only PDF files are supported" },
      { status: 400 },
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return Response.json(
      { error: "File size must be less than 10MB" },
      { status: 400 },
    );
  }

  log.info("Processing resume upload", {
    fileName: file.name,
    fileSize: file.size,
  });

  // Read file buffer and upload to storage first
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const storagePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await serviceSupabase.storage
    .from("resumes")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    log.error("Storage upload error", { error: uploadError.message });
    return Response.json({ error: "Failed to upload file" }, { status: 500 });
  }

  // Create job record
  const { data: job, error: jobError } = await serviceSupabase
    .from("document_jobs")
    .insert({
      user_id: user.id,
      job_type: "resume",
      filename: file.name,
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
    name: "resume/process",
    data: {
      jobId: job.id,
      userId: user.id,
      filename: file.name,
      storagePath,
    },
  });

  // Increment upload count after successful job creation
  await incrementUploadCount(serviceSupabase, user.id);

  // Return immediately with job ID
  return Response.json({ jobId: job.id });
});
