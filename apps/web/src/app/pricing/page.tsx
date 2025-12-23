"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("monthly");

  return (
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
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingPeriod === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("annual")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  billingPeriod === "annual"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                  Save 17%
                </span>
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Tier */}
              <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-8 space-y-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-2xl">Free</h3>
                  <p className="text-muted-foreground">Get started building your identity.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3 pt-4">
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>1 document upload</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>3 tailored profiles per month</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Basic identity graph</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Shareable profile links</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/login">Get Started</Link>
                </Button>
              </div>

              {/* Pro Tier */}
              <div className="rounded-2xl border-2 border-primary bg-card text-card-foreground shadow-lg p-8 space-y-6 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                  Recommended
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-2xl">Pro</h3>
                  <p className="text-muted-foreground">For serious job seekers.</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">
                    ${billingPeriod === "monthly" ? "30" : "25"}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingPeriod === "annual" && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ($300/year)
                    </span>
                  )}
                </div>
                <ul className="space-y-3 pt-4">
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Unlimited document uploads</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Unlimited tailored profiles</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Full identity graph with evidence</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Profile view tracking</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>PDF export</span>
                  </li>
                  <li className="flex gap-2">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/login">Start Free Trial</Link>
                </Button>
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
          </Accordion>
        </div>
      </div>
    </div>
  );
}
