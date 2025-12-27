"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Building2, User, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useSubscription, useCreateSubscription, useInvalidateSubscription } from "@/hooks/use-subscription";
import { PaymentModal } from "@/components/billing/payment-modal";
import { toast } from "sonner";

export default function PricingPage() {
  const searchParams = useSearchParams();
  const { data: subscriptionData } = useSubscription();
  const subscriptionMutation = useCreateSubscription();
  const invalidateSubscription = useInvalidateSubscription();

  const [loadingPlan, setLoadingPlan] = useState<"pro" | "job_search" | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"pro" | "job_search">("pro");

  const currentPlan = subscriptionData?.subscription?.plan_type || null;
  const isAuthenticated = !!subscriptionData;

  // Handle success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Subscription updated successfully!");
      invalidateSubscription();
      window.history.replaceState({}, "", "/pricing");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout was canceled.");
      window.history.replaceState({}, "", "/pricing");
    }
  }, [searchParams, invalidateSubscription]);

  const handleUpgrade = async (plan: "pro" | "job_search") => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      window.location.href = `/login?returnTo=/pricing?plan=${plan}`;
      return;
    }

    setLoadingPlan(plan);
    setSelectedPlan(plan);

    try {
      const result = await subscriptionMutation.mutateAsync({ plan });
      setClientSecret(result.clientSecret);
      setPaymentModalOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentModalOpen(false);
    setClientSecret(null);
    invalidateSubscription();
    toast.success("Subscription activated!");
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setPaymentModalOpen(false);
      setClientSecret(null);
    }
  };

  return (
    <>
      <div className="flex flex-col min-h-[calc(100vh-3.5rem)] py-20 px-4">
        <div className="container mx-auto max-w-6xl space-y-16">

          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Build your professional identity. Share it with the right people.
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="candidates" className="w-full">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="candidates" className="gap-2">
                <User className="h-4 w-4" />
                For Candidates
              </TabsTrigger>
              <TabsTrigger value="companies" className="gap-2">
                <Building2 className="h-4 w-4" />
                For Companies
              </TabsTrigger>
            </TabsList>

            {/* Candidates Pricing */}
            <TabsContent value="candidates" className="mt-12">
              <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
                {/* Free Tier */}
                <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative flex flex-col">
                  {currentPlan === "free" && (
                    <Badge className="absolute -top-3 left-4" variant="secondary">
                      Current Plan
                    </Badge>
                  )}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl h-7 flex items-center">Free</h3>
                    <p className="text-sm text-muted-foreground">Get started building your identity.</p>
                  </div>
                  <div className="flex items-baseline gap-1 mt-6">
                    <span className="text-3xl font-bold">$0</span>
                    <span className="text-muted-foreground text-sm">forever</span>
                  </div>
                  <ul className="space-y-2 text-sm mt-6 flex-1">
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>1 document upload per month</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>5 tailored profiles per month</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Basic identity graph</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Shareable profile links</span>
                    </li>
                  </ul>
                  <Button className="w-full mt-6" variant="outline" asChild>
                    <Link href="/login">Get Started</Link>
                  </Button>
                </div>

                {/* Pro Tier */}
                <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 relative flex flex-col">
                  {currentPlan === "pro" && (
                    <Badge className="absolute -top-3 left-4">
                      Current Plan
                    </Badge>
                  )}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl h-7 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Pro
                    </h3>
                    <p className="text-sm text-muted-foreground">For career builders.</p>
                  </div>
                  <div className="flex items-baseline gap-1 mt-6">
                    <span className="text-3xl font-bold">$100</span>
                    <span className="text-muted-foreground text-sm">/year</span>
                  </div>
                  <ul className="space-y-2 text-sm mt-6 flex-1">
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Unlimited document uploads</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>15 tailored profiles per month</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Full identity graph with evidence</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Profile view tracking</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>PDF export</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                  {currentPlan === "pro" ? (
                    <Button className="w-full mt-6" variant="outline" asChild>
                      <Link href="/settings/usage">Manage Plan</Link>
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-6"
                      onClick={() => handleUpgrade("pro")}
                      disabled={loadingPlan !== null || currentPlan === "job_search"}
                    >
                      {loadingPlan === "pro" ? "Loading..." : "Subscribe"}
                    </Button>
                  )}
                </div>

                {/* Job Search Tier */}
                <div className="rounded-2xl border-2 border-primary bg-card text-card-foreground shadow-lg p-6 relative flex flex-col">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap">
                    Best for job seekers
                  </div>
                  {currentPlan === "job_search" && (
                    <Badge className="absolute -top-3 right-4">
                      Current Plan
                    </Badge>
                  )}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xl h-7 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Job Search
                    </h3>
                    <p className="text-sm text-muted-foreground">For active job hunters.</p>
                  </div>
                  <div className="flex items-baseline gap-1 mt-6">
                    <span className="text-3xl font-bold">$50</span>
                    <span className="text-muted-foreground text-sm">/3 months</span>
                  </div>
                  <ul className="space-y-2 text-sm mt-6 flex-1">
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="font-medium">Unlimited everything</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Unlimited document uploads</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Unlimited tailored profiles</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>All Pro features included</span>
                    </li>
                    <li className="flex gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>Perfect for job search sprints</span>
                    </li>
                  </ul>
                  {currentPlan === "job_search" ? (
                    <Button className="w-full mt-6" variant="outline" asChild>
                      <Link href="/settings/usage">Manage Plan</Link>
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-6"
                      onClick={() => handleUpgrade("job_search")}
                      disabled={loadingPlan !== null}
                    >
                      {loadingPlan === "job_search" ? "Loading..." : "Subscribe"}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Companies Pricing */}
            <TabsContent value="companies" className="mt-12">
              <div className="max-w-3xl mx-auto">
                <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-8 md:p-12 space-y-8">
                  <div className="space-y-4 text-center">
                    <h3 className="font-semibold text-3xl">Post Jobs, Get Tailored Applicants</h3>
                    <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                      Candidates don&apos;t send generic resumes. They send profiles tailored
                      to your role—with evidence behind every claim.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-4">
                      <h4 className="font-medium">What you get</h4>
                      <ul className="space-y-3">
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0" />
                          <span>Post unlimited job listings</span>
                        </li>
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0" />
                          <span>Receive tailored candidate profiles</span>
                        </li>
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0" />
                          <span>Evidence-backed claims with confidence scores</span>
                        </li>
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0" />
                          <span>Team collaboration tools</span>
                        </li>
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-medium">Coming soon</h4>
                      <ul className="space-y-3">
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">ATS integrations</span>
                        </li>
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">API access</span>
                        </li>
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Candidate messaging</span>
                        </li>
                        <li className="flex gap-2">
                          <Check className="h-5 w-5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Analytics dashboard</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" asChild>
                      <Link href="/contact">Contact Sales</Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild>
                      <Link href="/recruiters">Learn More</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto pt-16">
            <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Can I cancel anytime?</AccordionTrigger>
                <AccordionContent>
                  Yes, you can cancel your subscription at any time. You&apos;ll keep access to your premium features until the end of your billing period.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>How does a tailored profile work?</AccordionTrigger>
                <AccordionContent>
                  Paste a job description, and we generate a unique profile page that highlights exactly how your experience matches that role—with evidence from your career to back it up. You share a link, and that&apos;s what they see.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>Is my data private?</AccordionTrigger>
                <AccordionContent>
                  Yes. Your data is encrypted and only accessible by you. We never share your profile with anyone unless you explicitly create and share a link. You can revoke access to any shared link at any time.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>What if I&apos;m not happy?</AccordionTrigger>
                <AccordionContent>
                  We offer a 14-day money-back guarantee on all paid plans. No questions asked.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger>What&apos;s the difference between Pro and Job Search?</AccordionTrigger>
                <AccordionContent>
                  Pro ($100/year) is for ongoing career management—keeping your identity up to date with 15 tailored profiles per month. Job Search ($50/3 months) is for when you&apos;re actively hunting—unlimited everything to maximize your chances during a job search sprint.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>

      <PaymentModal
        open={paymentModalOpen}
        onOpenChange={handleModalClose}
        clientSecret={clientSecret}
        plan={selectedPlan}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </>
  );
}
