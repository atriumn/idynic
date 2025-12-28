import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getStripe } from "@/lib/billing/stripe";
import { apiError } from "@/lib/api/response";

interface DeleteAccountRequest {
  password: string;
  confirmation: string;
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return apiError("unauthorized", "Authentication required", 401);
  }

  let body: DeleteAccountRequest;
  try {
    body = await request.json();
  } catch {
    return apiError("invalid_request", "Invalid request body", 400);
  }

  // 1. Validate confirmation text
  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return apiError(
      "invalid_confirmation",
      "Confirmation text must be exactly 'DELETE MY ACCOUNT'",
      400
    );
  }

  // 2. Verify password
  if (!body.password) {
    return apiError("invalid_password", "Password is required", 400);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: body.password,
  });

  if (signInError) {
    return apiError("invalid_password", "Password verification failed", 403);
  }

  const serviceClient = createServiceRoleClient();

  try {
    // 3. Cancel Stripe subscription if exists
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .single();

    if (subscription?.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (err) {
        console.error("Failed to cancel Stripe subscription:", err);
        // Continue with deletion even if Stripe fails
      }
    }

    // 4. Delete storage files
    try {
      const { data: files } = await serviceClient.storage
        .from("resumes")
        .list(user.id);

      if (files?.length) {
        const filePaths = files.map((f) => `${user.id}/${f.name}`);
        await serviceClient.storage.from("resumes").remove(filePaths);
      }
    } catch (err) {
      console.error("Failed to delete storage files:", err);
      // Continue with deletion even if storage fails
    }

    // 5. Delete database records
    // Order matters for some foreign key constraints
    // Most will cascade from profiles, but we delete explicitly for auditability

    // Delete shared_link_views first (references shared_links)
    const { data: userSharedLinks } = await serviceClient
      .from("shared_links")
      .select("id")
      .eq("user_id", user.id);

    if (userSharedLinks?.length) {
      await serviceClient
        .from("shared_link_views")
        .delete()
        .in(
          "shared_link_id",
          userSharedLinks.map((sl) => sl.id)
        );
    }

    // Delete claim_evidence (junction table referencing claims)
    const { data: userClaims } = await serviceClient
      .from("claims")
      .select("id")
      .eq("user_id", user.id);

    if (userClaims?.length) {
      await serviceClient
        .from("claim_evidence")
        .delete()
        .in(
          "claim_id",
          userClaims.map((c) => c.id)
        );
    }

    // Delete remaining tables in order
    const tablesToDelete = [
      "shared_links",
      "tailored_profiles",
      "matches",
      "opportunity_notes",
      "opportunities",
      "claims",
      "evidence",
      "work_history",
      "document_jobs",
      "documents",
      "identity_claims",
      "api_keys",
      "usage_tracking",
      "ai_usage_log",
      "subscriptions",
    ] as const;

    for (const table of tablesToDelete) {
      await serviceClient.from(table).delete().eq("user_id", user.id);
    }

    // Delete profile (this may cascade remaining records)
    await serviceClient.from("profiles").delete().eq("id", user.id);

    // 6. Delete auth user
    const { error: deleteUserError } =
      await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("Failed to delete auth user:", deleteUserError);
      // Profile already deleted, log but don't fail
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return apiError("deletion_failed", "Failed to delete account", 500);
  }
}
