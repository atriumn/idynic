import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Check,
  FileText,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

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
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-background pt-20 pb-32 md:pt-32 md:pb-48">
         {/* Background pattern */}
         <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
             <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
         </div>

        <div className="container mx-auto px-4 text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl max-w-4xl mx-auto">
            You&apos;ve done more than <br className="hidden md:block" />
            your resume says.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Build your complete professional identity once. Generate a unique, tailored profile for every opportunity.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button asChild size="lg" className="h-12 px-8 text-base shadow-lg shadow-primary/20">
              <Link href="/login">
                Start building
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base">
              <Link href="/recruiters">
                For recruiters
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

            {/* Step 1: Upload */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">1</div>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Upload</span>
                    </div>
                    <h2 className="text-3xl font-bold">Drop in what you have.</h2>
                    <p className="text-lg text-muted-foreground">
                        Resumes, project docs, performance reviews—or just write freely about what you&apos;ve done. Our AI structures and connects it. You&apos;re still responsible for what you claim, same as any resume.
                    </p>
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Upload documents or write stories directly</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>AI extracts and organizes—you verify</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Private until you choose to share</span>
                        </li>
                    </ul>
                </div>
                <div className="relative aspect-square md:aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border shadow-sm flex items-center justify-center overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 group-hover:opacity-75 transition-opacity"></div>
                     <FileText className="h-16 w-16 text-muted-foreground/30" />
                </div>
            </div>

            {/* Step 2: Structure */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 relative aspect-square md:aspect-video rounded-xl bg-slate-100 dark:bg-slate-800 border shadow-sm flex items-center justify-center overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-tr from-green-500/10 to-blue-500/10 group-hover:opacity-75 transition-opacity"></div>
                    <Sparkles className="h-16 w-16 text-muted-foreground/30" />
                </div>
                <div className="order-1 md:order-2 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">2</div>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Structure</span>
                    </div>
                    <h2 className="text-3xl font-bold">See what you&apos;ve actually built.</h2>
                    <p className="text-lg text-muted-foreground">
                        Your career becomes a graph of connected claims—skills, achievements, and experience—each backed by evidence. Confidence scores show what&apos;s proven vs. what&apos;s asserted.
                    </p>
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Claims linked to source documents</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Connections between related skills</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Refine and add detail anytime</span>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Step 3: Share */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">3</div>
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Share</span>
                    </div>
                    <h2 className="text-3xl font-bold">A unique profile for every opportunity.</h2>
                    <p className="text-lg text-muted-foreground">
                        Paste a job description. We generate a tailored profile page showing exactly why you&apos;re a fit—with the evidence to back it up. One link. Their eyes only.
                    </p>
                    <ul className="space-y-3 pt-2">
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Unique shareable URL per opportunity</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>See when recruiters view your profile</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <CheckIcon />
                            <span>Revoke access anytime</span>
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

      {/* What makes this different */}
      <section className="py-24 px-4 bg-muted/50">
          <div className="container mx-auto max-w-6xl">
              <div className="text-center max-w-2xl mx-auto mb-16">
                  <h2 className="text-3xl font-bold mb-4">Not another resume tool.</h2>
                  <p className="text-muted-foreground text-lg">We&apos;re building infrastructure for professional identity.</p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  <FeatureCard
                    icon={<Sparkles className="w-6 h-6" />}
                    title="Evidence, not assertions"
                    description="Every claim links back to the document that proves it. Confidence scores show what's solid."
                  />
                  <FeatureCard
                    icon={<Target className="w-6 h-6" />}
                    title="Structure, not summaries"
                    description="Your career as queryable data. Find the right experience for any opportunity instantly."
                  />
                  <FeatureCard
                    icon={<Users className="w-6 h-6" />}
                    title="Share context, not files"
                    description="Generate tailored views with tracking. Know when they're viewed."
                  />
                  <FeatureCard
                    icon={<Shield className="w-6 h-6" />}
                    title="Your data, your control"
                    description="Private by default. Revoke access anytime. We don't sell to recruiters."
                  />
                  <FeatureCard
                    icon={<Zap className="w-6 h-6" />}
                    title="Add depth over time"
                    description="New project? New role? Add it. Your identity grows with your career."
                  />
                  <FeatureCard
                    icon={<Briefcase className="w-6 h-6" />}
                    title="Works with what you have"
                    description="Start with a resume. Add stories, reviews, project docs. We synthesize it all."
                  />
              </div>
          </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24 bg-background">
        <div className="max-w-4xl mx-auto text-center space-y-8 bg-gradient-to-b from-muted/50 to-muted rounded-3xl p-8 md:p-16 border">
          <h2 className="text-3xl md:text-4xl font-bold">Your career deserves more than a page.</h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Start building your complete professional identity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg h-12 px-8">
                <Link href="/login">Get started free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg h-12 px-8 bg-background">
                <Link href="/pricing">See pricing</Link>
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