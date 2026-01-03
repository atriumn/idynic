import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Check,
  Cuboid,
  Database,
  FileText,
  Shield,
  Smartphone,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RotatingScenarios } from "@/components/rotating-scenarios";
import { createClient } from "@/lib/supabase/server";

import { MeshBackground } from "@/components/ui/mesh-background";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in, redirect to identity page
  if (user) {
    redirect("/identity");
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] relative">
      <MeshBackground intensity="medium" />

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-32 md:pt-32 md:pb-48">
         {/* Background pattern */}
         <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
             <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
         </div>

        <div className="container mx-auto px-4 text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl max-w-4xl mx-auto">
            Your career is your most valuable asset.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Stop managing it like a folder of old files. Build a verified Master Record of your achievements, then assemble tailored applications in seconds.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button asChild size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
              <Link href="/login">
                Start Building
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
              <Link href="/trust">
                How it works
              </Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground pt-4">
             Free to start · No credit card required
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-4 bg-background">
        <div className="container max-w-6xl mx-auto space-y-24">

            {/* Step 1: Extract */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Deconstruct</span>
                    </div>
                    <h2 className="text-3xl font-bold">Turn documents into data.</h2>
                    <p className="text-lg text-muted-foreground">
                        Don&apos;t just upload files. Idynic extracts every individual skill, project, and achievement into atomic <strong>Evidence Blocks</strong>. Your history becomes a database, not a document.
                    </p>
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Upload resumes, reviews, and project specs</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>AI identifies key skills and metrics</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Broken down into reusable blocks</span>
                        </li>
                    </ul>
                </div>
                <div className="relative aspect-square md:aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border shadow-sm flex items-center justify-center overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 group-hover:opacity-75 transition-opacity"></div>
                     <FileText className="h-16 w-16 text-muted-foreground/30" />
                </div>
            </div>

            {/* Step 2: Master Record */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 relative aspect-square md:aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border shadow-sm flex items-center justify-center overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-green-500/10 to-blue-500/10 group-hover:opacity-75 transition-opacity"></div>
                    <Database className="h-16 w-16 text-muted-foreground/30" />
                </div>
                <div className="order-1 md:order-2 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Verify</span>
                    </div>
                    <h2 className="text-3xl font-bold">Build your Master Record.</h2>
                    <p className="text-lg text-muted-foreground">
                        Every Evidence Block is linked to its source. See exactly what you can prove. <strong>Confidence Scores</strong> separate hard facts from fuzzy memories, decaying older skills over time.
                    </p>
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>One unified source of truth</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Evidence linked to original docs</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Algorithmic confidence scoring</span>
                        </li>
                    </ul>
                    <div className="pt-2">
                      <Link href="/trust" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                        See how our scoring works <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                </div>
            </div>

            {/* Step 3: Assemble */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Assemble</span>
                    </div>
                    <h2 className="text-3xl font-bold">Targeted profiles, instantly.</h2>
                    <p className="text-lg text-muted-foreground">
                        Paste a job description. We pick the exact Evidence Blocks that match the role and assemble them into a persuasive, evidence-backed profile. No hallucination—just your best facts, reordered for impact.
                    </p>
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Tailored to specific job requirements</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Generates talking points for interviews</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Share as a link or export to PDF</span>
                        </li>
                    </ul>
                </div>
                <div className="relative aspect-square md:aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border shadow-sm flex items-center justify-center overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-bl from-purple-500/10 to-pink-500/10 group-hover:opacity-75 transition-opacity"></div>
                     <Users className="h-16 w-16 text-muted-foreground/30" />
                </div>
            </div>
        </div>
      </section>

      {/* Rotating Scenarios */}
      <section className="py-24 px-4 bg-muted/50">
        <div className="container mx-auto max-w-3xl">
          <RotatingScenarios />
        </div>
      </section>

      {/* Student Callout */}
      <section className="py-12 px-4 bg-background border-y">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-bold">Building your career from scratch?</h3>
              <p className="text-muted-foreground">
                Turn your coursework and projects into professional Evidence Blocks.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/students">
                For Students <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What makes this different */}
      <section className="py-24 px-4 bg-background">
          <div className="container mx-auto max-w-6xl">
              <div className="text-center max-w-2xl mx-auto mb-16">
                  <h2 className="text-3xl font-bold mb-4">Not another resume tool.</h2>
                  <p className="text-muted-foreground text-lg">We&apos;re building the operating system for your professional identity.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  <FeatureCard
                    icon={<Cuboid className="w-6 h-6" />}
                    title="Evidence Blocks"
                    description="Your experience is stored as atomic, reusable blocks—not flat text."
                  />
                  <FeatureCard
                    icon={<Target className="w-6 h-6" />}
                    title="Instant Assembly"
                    description="Construct the perfect profile for any opportunity in seconds."
                  />
                  <FeatureCard
                    icon={<Users className="w-6 h-6" />}
                    title="Context Aware"
                    description="Present different sides of your experience to different audiences."
                  />
                  <FeatureCard
                    icon={<Shield className="w-6 h-6" />}
                    title="Verified Truth"
                    description="Confidence scores show what's solid. Recency decay keeps it honest."
                  />
                  <FeatureCard
                    icon={<Zap className="w-6 h-6" />}
                    title="Grow Your Asset"
                    description="New project? Add it to the pile. Your Master Record grows with you."
                  />
                  <FeatureCard
                    icon={<Briefcase className="w-6 h-6" />}
                    title="Import Anything"
                    description="Resumes, reviews, specs. If it's text, we can turn it into data."
                  />
              </div>
          </div>
      </section>

      {/* Get the App */}
      <section className="py-24 px-4 bg-muted/50">
        <div className="container mx-auto max-w-4xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <Smartphone className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-bold">Take Idynic on the go.</h2>
              <p className="text-lg text-muted-foreground">
                Capture wins as they happen. Add Evidence Blocks from your phone immediately after a meeting or launch.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="#"
                  className="hover:opacity-80 transition-opacity"
                  aria-label="Download on the App Store"
                >
                  <Image
                    src="/app-store-badge.svg"
                    alt="Download on the App Store"
                    width={120}
                    height={40}
                    className="h-10 w-auto"
                  />
                </Link>
                <Link
                  href="#"
                  className="hover:opacity-80 transition-opacity"
                  aria-label="Get it on Google Play"
                >
                  <Image
                    src="/google-play-badge.svg"
                    alt="Get it on Google Play"
                    width={135}
                    height={40}
                    className="h-10 w-auto"
                  />
                </Link>
              </div>
            </div>
            <div className="relative aspect-square md:aspect-[3/4] rounded-2xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent border shadow-lg flex items-center justify-center overflow-hidden">
              <div className="absolute inset-4 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Smartphone className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-sm text-slate-500">App Preview</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24 bg-background">
        <div className="max-w-4xl mx-auto text-center space-y-8 bg-gradient-to-b from-background to-muted/50 rounded-3xl p-8 md:p-16 border">
          <h2 className="text-3xl md:text-4xl font-bold">Start building your Master Record.</h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your career is too important to leave in a folder of old PDFs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg h-12 px-8">
                <Link href="/login">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg h-12 px-8 bg-background">
                <Link href="/pricing">View Plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                {icon}
            </div>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-muted-foreground">{description}</p>
        </div>
    )
}

function CheckIcon() {
    return (
        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
        </div>
    )
}