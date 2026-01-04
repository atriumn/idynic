import { RecruiterWaitlistForm } from "@/components/recruiter-waitlist-form";
import { Briefcase, FileCheck, Users, Zap } from "lucide-react";
import Image from "next/image";

export default function RecruitersPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero Section */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-20 px-4">
        <div className="container mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Post a job. <br /> Get tailored applicants.
            </h1>
            <p className="text-xl text-muted-foreground">
              Candidates on Idynic don&apos;t send generic resumes. They send
              profiles tailored specifically to your role—with evidence behind
              every claim.
            </p>
            <div className="pt-4 max-w-md">
              <div className="bg-background p-6 rounded-lg border shadow-sm">
                <h3 className="font-semibold mb-4">Join the waitlist</h3>
                <RecruiterWaitlistForm />
              </div>
            </div>
          </div>
          <div className="relative h-[400px] rounded-xl overflow-hidden border shadow-sm group bg-slate-950">
            <Image
              src="/images/recruiter-hero.png"
              alt="Recruiter dashboard filtering candidates by evidence"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold">How it works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A better way to receive applications.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary font-bold text-xl">
                1
              </div>
              <h3 className="font-semibold text-xl">Post your job</h3>
              <p className="text-muted-foreground">
                Add your open roles to Idynic. Include the job description,
                requirements, and what you&apos;re looking for.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary font-bold text-xl">
                2
              </div>
              <h3 className="font-semibold text-xl">
                Candidates tailor their profiles
              </h3>
              <p className="text-muted-foreground">
                Interested candidates generate a profile specifically for your
                role, highlighting relevant experience with evidence.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary font-bold text-xl">
                3
              </div>
              <h3 className="font-semibold text-xl">
                Review quality applications
              </h3>
              <p className="text-muted-foreground">
                Receive applications where candidates have already done the work
                of showing why they&apos;re a fit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl font-bold">Why Idynic?</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">
                Evidence-backed claims
              </h3>
              <p className="text-muted-foreground">
                Every claim in a candidate&apos;s profile links back to source
                material. See confidence scores that show what&apos;s proven vs.
                what&apos;s asserted.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">
                Pre-qualified interest
              </h3>
              <p className="text-muted-foreground">
                Candidates who apply have already invested time understanding
                your role and articulating their fit. No spray-and-pray
                applications.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">
                Context, not keywords
              </h3>
              <p className="text-muted-foreground">
                See how a candidate&apos;s actual experience maps to your
                requirements—not just keyword matches on a resume.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">Simple to start</h3>
              <p className="text-muted-foreground">
                Post a job in minutes. No complex integrations required. Start
                receiving tailored applications immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold">
            Ready to try a better way to hire?
          </h2>
          <p className="text-xl opacity-90">
            Join the waitlist for early access.
          </p>
          <div className="max-w-md mx-auto bg-background p-6 rounded-lg text-foreground">
            <RecruiterWaitlistForm />
          </div>
        </div>
      </section>
    </div>
  );
}
