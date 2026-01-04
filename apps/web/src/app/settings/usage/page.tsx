"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSubscription,
  useCreateCheckoutSession,
  useCreatePortalSession,
  useInvalidateSubscription,
} from "@/hooks/use-subscription";
import { Check, ExternalLink, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

const PLAN_BADGES: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  free: { label: "Free", variant: "secondary" },
  pro: { label: "Pro", variant: "default" },
  job_search: { label: "Job Search", variant: "default" },
};

export default function UsagePage() {
  const searchParams = useSearchParams();
  const { data, isLoading, error } = useSubscription();
  const checkoutMutation = useCreateCheckoutSession();
  const portalMutation = useCreatePortalSession();
  const invalidateSubscription = useInvalidateSubscription();

  // Handle success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription updated successfully!");
      invalidateSubscription();
      // Clean up URL
      window.history.replaceState({}, "", "/settings/usage");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout was canceled.");
      window.history.replaceState({}, "", "/settings/usage");
    }
  }, [searchParams, invalidateSubscription]);

  const handleUpgrade = (plan: "pro" | "job_search") => {
    checkoutMutation.mutate({
      plan,
      successUrl: `${window.location.origin}/settings/usage?success=true`,
      cancelUrl: `${window.location.origin}/settings/usage?canceled=true`,
    });
  };

  const handleManageSubscription = () => {
    portalMutation.mutate({
      returnUrl: `${window.location.origin}/settings/usage`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Unable to load subscription data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { subscription, usage, limits } = data;
  const planBadge = PLAN_BADGES[subscription.plan_type] || PLAN_BADGES.free;
  const isPaid = subscription.plan_type !== "free";

  const resetDate = new Date(usage.period_end);
  resetDate.setDate(resetDate.getDate() + 1);

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Plan
                <Badge variant={planBadge.variant}>{planBadge.label}</Badge>
              </CardTitle>
              <CardDescription>
                {subscription.status === "active"
                  ? isPaid
                    ? `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
                    : "Free forever"
                  : `Status: ${subscription.status}`}
              </CardDescription>
            </div>
            {isPaid && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={portalMutation.isPending}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            )}
          </div>
        </CardHeader>
        {subscription.cancel_at_period_end && (
          <CardContent>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
              Your subscription will be canceled at the end of the current
              billing period.
            </div>
          </CardContent>
        )}
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>
            Resets on {resetDate.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Documents Uploaded */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Documents Uploaded</span>
              <span className="text-muted-foreground">
                {limits.uploads_per_month === null
                  ? `${usage.uploads} (Unlimited)`
                  : `${usage.uploads} / ${limits.uploads_per_month}`}
              </span>
            </div>
            {limits.uploads_per_month !== null && (
              <Progress
                value={(usage.uploads / limits.uploads_per_month) * 100}
                className="h-2"
              />
            )}
            {limits.uploads_per_month === null && (
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary/50 to-primary w-full" />
              </div>
            )}
          </div>

          {/* Tailored Profiles */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Tailored Profiles Created</span>
              <span className="text-muted-foreground">
                {limits.tailored_profiles_per_month === null
                  ? `${usage.tailored_profiles} (Unlimited)`
                  : `${usage.tailored_profiles} / ${limits.tailored_profiles_per_month}`}
              </span>
            </div>
            {limits.tailored_profiles_per_month !== null && (
              <Progress
                value={
                  (usage.tailored_profiles /
                    limits.tailored_profiles_per_month) *
                  100
                }
                className="h-2"
              />
            )}
            {limits.tailored_profiles_per_month === null && (
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary/50 to-primary w-full" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options (only show if not on job_search) */}
      {subscription.plan_type !== "job_search" && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Your Plan</CardTitle>
            <CardDescription>
              Get more out of Idynic with a premium plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pro Plan */}
              {subscription.plan_type !== "pro" && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Pro
                      </h3>
                      <p className="text-sm text-muted-foreground">$100/year</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUpgrade("pro")}
                      disabled={checkoutMutation.isPending}
                    >
                      Upgrade
                    </Button>
                  </div>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-primary" />
                      Unlimited document uploads
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-primary" />
                      15 tailored profiles/month
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-primary" />
                      PDF export & view tracking
                    </li>
                  </ul>
                </div>
              )}

              {/* Job Search Plan */}
              <div className="border-2 border-primary rounded-lg p-4 space-y-4 relative">
                <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  Best for active job seekers
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Job Search
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      $50 for 3 months
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleUpgrade("job_search")}
                    disabled={checkoutMutation.isPending}
                  >
                    Upgrade
                  </Button>
                </div>
                <ul className="text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" />
                    Unlimited everything
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" />
                    Perfect for job search sprints
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" />
                    All premium features
                  </li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              <Link href="/pricing" className="underline">
                View full pricing details
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
