import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/response";
import JSZip from "jszip";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "Authentication required", 401);
  }

  try {
    const zip = new JSZip();
    const documentsFolder = zip.folder("documents");
    const exportDate = new Date().toISOString().split("T")[0];

    // Fetch all user data in parallel
    const [
      profileResult,
      subscriptionResult,
      usageResult,
      documentsResult,
      workHistoryResult,
      identityClaimsResult,
      evidenceResult,
      opportunitiesResult,
      tailoredProfilesResult,
      opportunityNotesResult,
      sharedLinksResult,
      apiKeysResult,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("usage_tracking")
        .select("*")
        .eq("user_id", user.id)
        .order("period_start", { ascending: false })
        .limit(1)
        .single(),
      supabase.from("documents").select("*").eq("user_id", user.id),
      supabase.from("work_history").select("*").eq("user_id", user.id),
      supabase.from("identity_claims").select("*").eq("user_id", user.id),
      supabase
        .from("evidence")
        .select(
          "id, evidence_type, text, context, source_type, evidence_date, created_at",
        )
        .eq("user_id", user.id),
      supabase.from("opportunities").select("*").eq("user_id", user.id),
      supabase.from("tailored_profiles").select("*").eq("user_id", user.id),
      supabase.from("opportunity_notes").select("*").eq("user_id", user.id),
      supabase.from("shared_links").select("*").eq("user_id", user.id),
      supabase
        .from("api_keys")
        .select(
          "id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at",
        )
        .eq("user_id", user.id),
    ]);

    const profile = profileResult.data;
    const subscription = subscriptionResult.data;
    const usage = usageResult.data;
    const documents = documentsResult.data || [];
    const workHistory = workHistoryResult.data || [];
    const identityClaims = identityClaimsResult.data || [];
    const evidence = evidenceResult.data || [];
    const opportunities = opportunitiesResult.data || [];
    const tailoredProfiles = tailoredProfilesResult.data || [];
    const opportunityNotes = opportunityNotesResult.data || [];
    const sharedLinks = sharedLinksResult.data || [];
    const apiKeys = apiKeysResult.data || [];

    // Get view counts for shared links
    const sharedLinkViewCounts: Record<string, number> = {};
    if (sharedLinks.length > 0) {
      const { data: viewCounts } = await supabase
        .from("shared_link_views")
        .select("shared_link_id")
        .in(
          "shared_link_id",
          sharedLinks.map((sl) => sl.id),
        );

      if (viewCounts) {
        for (const view of viewCounts) {
          sharedLinkViewCounts[view.shared_link_id] =
            (sharedLinkViewCounts[view.shared_link_id] || 0) + 1;
        }
      }
    }

    // Download and add document files to ZIP
    const documentExports = await Promise.all(
      documents.map(async (doc) => {
        const filename = doc.filename || `document-${doc.id}`;
        const localPath = `documents/${filename}`;

        if (doc.storage_path) {
          try {
            const { data: fileData } = await supabase.storage
              .from("resumes")
              .download(doc.storage_path);

            if (fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              documentsFolder?.file(filename, arrayBuffer);
            }
          } catch (err) {
            console.error(`Failed to download file ${doc.storage_path}:`, err);
          }
        }

        return {
          id: doc.id,
          type: doc.type,
          filename,
          createdAt: doc.created_at,
          rawText: doc.raw_text,
          localPath,
        };
      }),
    );

    // Build export data object
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",

      profile: profile
        ? {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            phone: profile.phone,
            location: profile.location,
            linkedin: profile.linkedin,
            github: profile.github,
            website: profile.website,
            identity: {
              headline: profile.identity_headline,
              bio: profile.identity_bio,
              archetype: profile.identity_archetype,
              keywords: profile.identity_keywords,
            },
            createdAt: profile.created_at,
          }
        : null,

      subscription: subscription
        ? {
            planType: subscription.plan_type,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start,
            currentPeriodEnd: subscription.current_period_end,
          }
        : null,

      usage: usage
        ? {
            uploadsCount: usage.uploads_count,
            tailoredProfilesCount: usage.tailored_profiles_count,
            periodStart: usage.period_start,
          }
        : null,

      documents: documentExports,

      workHistory: workHistory.map((wh) => ({
        id: wh.id,
        company: wh.company,
        title: wh.title,
        startDate: wh.start_date,
        endDate: wh.end_date,
        location: wh.location,
        summary: wh.summary,
        entryType: wh.entry_type,
        createdAt: wh.created_at,
      })),

      identityClaims: identityClaims.map((ic) => ({
        id: ic.id,
        type: ic.type,
        label: ic.label,
        description: ic.description,
        confidence: ic.confidence,
        source: ic.source,
        createdAt: ic.created_at,
      })),

      evidence: evidence.map((e) => ({
        id: e.id,
        type: e.evidence_type,
        text: e.text,
        context: e.context,
        sourceType: e.source_type,
        evidenceDate: e.evidence_date,
        createdAt: e.created_at,
      })),

      opportunities: opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        company: o.company,
        url: o.url,
        description: o.description,
        requirements: o.requirements,
        status: o.status,
        location: o.location,
        salaryMin: o.salary_min,
        salaryMax: o.salary_max,
        companyResearch: {
          url: o.company_url,
          industry: o.company_industry,
          roleContext: o.company_role_context,
          recentNews: o.company_recent_news,
          challenges: o.company_challenges,
        },
        createdAt: o.created_at,
      })),

      tailoredProfiles: tailoredProfiles.map((tp) => ({
        id: tp.id,
        opportunityId: tp.opportunity_id,
        talkingPoints: tp.talking_points,
        narrative: tp.narrative,
        resumeData: tp.resume_data,
        createdAt: tp.created_at,
      })),

      opportunityNotes: opportunityNotes.map((on) => ({
        id: on.id,
        opportunityId: on.opportunity_id,
        techStackRating: on.rating_tech_stack,
        companyRating: on.rating_company,
        industryRating: on.rating_industry,
        roleFitRating: on.rating_role_fit,
        links: on.links,
        notes: on.notes,
        createdAt: on.created_at,
      })),

      sharedLinks: sharedLinks.map((sl) => ({
        id: sl.id,
        tailoredProfileId: sl.tailored_profile_id,
        token: sl.token,
        expiresAt: sl.expires_at,
        revokedAt: sl.revoked_at,
        createdAt: sl.created_at,
        viewCount: sharedLinkViewCounts[sl.id] || 0,
      })),

      apiKeys: apiKeys.map((ak) => ({
        id: ak.id,
        name: ak.name,
        keyPrefix: ak.key_prefix,
        scopes: ak.scopes,
        lastUsedAt: ak.last_used_at,
        expiresAt: ak.expires_at,
        revokedAt: ak.revoked_at,
        createdAt: ak.created_at,
      })),
    };

    // Add data.json to ZIP
    zip.file("data.json", JSON.stringify(exportData, null, 2));

    // Add README.txt
    const readme = `Idynic Data Export
==================
Exported: ${exportData.exportedAt}
User: ${profile?.email || user.email}

This archive contains all your data from Idynic.

Contents:
- data.json: All your structured data in JSON format
- documents/: Your uploaded documents (PDFs)

For questions about this export, visit: https://idynic.com/help
To delete your account, visit: https://idynic.com/settings/account
`;
    zip.file("README.txt", readme);

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="idynic-export-${exportDate}.zip"`,
      },
    });
  } catch (error) {
    console.error("Data export failed:", error);
    return apiError("export_failed", "Failed to export data", 500);
  }
}
