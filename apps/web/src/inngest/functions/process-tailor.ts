import { inngest } from "../client";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { generateTalkingPoints } from "@/lib/ai/generate-talking-points";
import { generateNarrative } from "@/lib/ai/generate-narrative";
import { generateResume } from "@/lib/ai/generate-resume";
import { evaluateTailoredProfile, getUserClaimsForEval } from "@/lib/ai/eval";
import { incrementTailoredProfileCount } from "@/lib/billing/check-usage";
import { createLogger } from "@/lib/logger";
import { JobUpdater } from "@/lib/jobs/job-updater";
import type { Json, TablesInsert } from "@/lib/supabase/types";

export const processTailor = inngest.createFunction(
  {
    id: "process-tailor",
    retries: 2,
    onFailure: async ({ event, error }) => {
      const supabase = createServiceRoleClient();
      const { jobId } = event.data.event.data;
      const errorMessage = error?.message || "Unknown error occurred";

      await supabase
        .from("document_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.error("[process-tailor] Job failed after retries:", { jobId, error: errorMessage });

      const { log } = await import("@/lib/logger");
      await log.flush();
    },
  },
  { event: "tailor/process" },
  async ({ event, step }) => {
    const { jobId, userId, opportunityId, regenerate } = event.data;
    const supabase = createServiceRoleClient();
    const jobLog = createLogger({ jobId, userId, opportunityId, inngest: true });
    const job = new JobUpdater(supabase, jobId);

    // Step 1: Validate and fetch opportunity
    const opportunity = await step.run("validate-opportunity", async () => {
      await job.setPhase("analyzing");
      jobLog.info("Starting tailor job");

      const { data: opp, error } = await supabase
        .from("opportunities")
        .select("id, title, company")
        .eq("id", opportunityId)
        .eq("user_id", userId)
        .single();

      if (error || !opp) {
        throw new Error("Opportunity not found");
      }

      await job.addHighlight(`Tailoring for ${opp.title}`, "found");
      if (opp.company) {
        await job.addHighlight(`at ${opp.company}`, "found");
      }

      return opp;
    });

    // Step 2: Delete existing profile if regenerating
    if (regenerate) {
      await step.run("delete-existing", async () => {
        jobLog.info("Regenerating - deleting existing profile");
        await supabase
          .from("tailored_profiles")
          .delete()
          .eq("user_id", userId)
          .eq("opportunity_id", opportunityId);
      });
    }

    // Step 3: Generate talking points
    const talkingPoints = await step.run("generate-talking-points", async () => {
      await job.addHighlight("Analyzing your experience...", "found");
      jobLog.info("Generating talking points");

      const points = await generateTalkingPoints(opportunityId, userId, supabase);

      await job.addHighlight(`Found ${points.strengths.length} talking points`, "found");
      return points;
    });

    // Step 4: Generate narrative
    const narrative = await step.run("generate-narrative", async () => {
      await job.setPhase("generating");
      await job.addHighlight("Crafting your narrative...", "found");
      jobLog.info("Generating narrative");

      return await generateNarrative(
        talkingPoints,
        opportunity.title,
        opportunity.company
      );
    });

    // Step 5: Generate resume
    const resumeData = await step.run("generate-resume", async () => {
      await job.addHighlight("Building tailored resume...", "found");
      jobLog.info("Generating resume data");

      return await generateResume(userId, opportunityId, talkingPoints, supabase);
    });

    // Step 6: Store profile
    const profile = await step.run("store-profile", async () => {
      jobLog.info("Storing tailored profile");

      const { data, error } = await supabase
        .from("tailored_profiles")
        .insert({
          user_id: userId,
          opportunity_id: opportunityId,
          talking_points: talkingPoints as unknown as Json,
          narrative,
          narrative_original: narrative,
          resume_data: resumeData as unknown as Json,
          resume_data_original: resumeData as unknown as Json,
          edited_fields: [],
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error(`Failed to save profile: ${error?.message}`);
      }

      return data;
    });

    // Step 7: Run evaluation (non-fatal)
    await step.run("evaluate-profile", async () => {
      await job.setPhase("evaluating");
      await job.addHighlight("Running quality checks...", "found");
      jobLog.info("Running evaluation");

      try {
        const userClaims = await getUserClaimsForEval(supabase, userId);
        const evaluation = await evaluateTailoredProfile({
          tailoredProfileId: profile.id,
          userId,
          narrative: profile.narrative || "",
          resumeData: profile.resume_data,
          userClaims,
        });

        const evalLogEntry: TablesInsert<"tailoring_eval_log"> = {
          tailored_profile_id: profile.id,
          user_id: userId,
          passed: evaluation.passed,
          grounding_passed: evaluation.grounding.passed,
          hallucinations: evaluation.grounding.hallucinations as unknown as Json,
          missed_opportunities: evaluation.utilization.missed as unknown as Json,
          gaps: evaluation.gaps as unknown as Json,
          eval_model: evaluation.model,
          eval_cost_cents: evaluation.costCents,
        };
        await supabase.from("tailoring_eval_log").insert(evalLogEntry);

        if (evaluation.passed) {
          await job.addHighlight("Quality checks passed!", "found");
        } else {
          await job.addHighlight("Review suggested - see details", "found");
        }

        jobLog.info("Evaluation complete", { passed: evaluation.passed });
      } catch (evalErr) {
        jobLog.error("Evaluation failed", { error: evalErr instanceof Error ? evalErr.message : String(evalErr) });
        // Don't fail the job - evaluation is optional
      }
    });

    // Step 8: Increment usage and complete
    await step.run("complete-job", async () => {
      await incrementTailoredProfileCount(supabase, userId);

      await supabase
        .from("document_jobs")
        .update({
          status: "completed",
          tailored_profile_id: profile.id,
          summary: {
            profileId: profile.id,
            opportunityId: opportunity.id,
            title: opportunity.title,
            company: opportunity.company,
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      jobLog.info("Job completed successfully");
    });

    const { log } = await import("@/lib/logger");
    await log.flush();

    return {
      status: "completed",
      profileId: profile.id,
      opportunityId: opportunity.id,
    };
  }
);
