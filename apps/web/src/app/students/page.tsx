import Link from "next/link";
import Image from "next/image";
import { BookOpen, Code, Rocket, ShieldCheck, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaitlistForm } from "@/components/waitlist-form";

export default function StudentsPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] py-20 px-4">
      <div className="container mx-auto max-w-5xl space-y-24">
        {/* Hero Section */}
        <div className="text-center space-y-8 max-w-3xl mx-auto">
          <Badge text="For Students & New Grads" />
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            The &ldquo;No Experience&rdquo; paradox ends here.
          </h1>
          <p className="text-xl text-muted-foreground">
            You have more experience than you think. Idynic turns your
            coursework, labs, and projects into a professional{" "}
            <strong>Master Record</strong> of verified skills.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="h-12 px-8">
              <Link href="/login">Start Building Your Record</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="h-12 px-8">
              <Link href="/trust">See How We Verify Skills</Link>
            </Button>
          </div>
        </div>

        {/* The Concept: From Homework to Blocks */}
        <div className="grid md:grid-cols-2 gap-16 items-center border-y py-24">
          <div className="space-y-6">
            <h2 className="text-3xl font-bold">
              Stop throwing away your coursework.
            </h2>
            <p className="text-lg text-muted-foreground">
              Most students finish a semester and let their projects die in a
              folder. On Idynic, those projects become{" "}
              <strong>Evidence Blocks</strong>—the modular building blocks of
              your first professional role.
            </p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Bank Your Homework</h4>
                  <p className="text-sm text-muted-foreground text-pretty">
                    Upload lab reports, problem sets, and essays. We extract the
                    proof that you can actually do the work.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Code className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold">Turn GitHub into Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Sync your repos. Idynic identifies the technologies and
                    complexities of your code, not just the commit history.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative aspect-square bg-slate-950 rounded-2xl border overflow-hidden group shadow-lg">
            <Image
              src="/images/student-hero.png"
              alt="Turning student coursework into professional evidence blocks"
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="space-y-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold">A better way to apply.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <StudentFeature
              icon={<Rocket className="w-5 h-5" />}
              title="Beat the Paradox"
              description="Entry-level jobs want 2 years of experience. We show them your 4 years of project-based evidence."
            />
            <StudentFeature
              icon={<ShieldCheck className="w-5 h-5" />}
              title="Proof, Not Fluff"
              description="Generic resumes are easy to ignore. Verified profiles with evidence links are impossible to dismiss."
            />
            <StudentFeature
              icon={<Layout className="w-5 h-5" />}
              title="Tailor in Seconds"
              description="Applying to an internship? A startup? A giant corp? Assemble a different profile for each role instantly."
            />
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 text-center space-y-8">
          <h2 className="text-3xl md:text-5xl font-bold">
            Don&apos;t graduate with an empty resume.
          </h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Start banking your wins now. By the time you reach senior year, you
            won&apos;t be writing a resume—you&apos;ll be assembling a career.
          </p>
          <Button
            size="lg"
            variant="secondary"
            asChild
            className="text-lg h-12 px-8"
          >
            <Link href="/login">Get Started Free</Link>
          </Button>
          <div className="pt-4 border-t border-primary-foreground/20 mt-8">
            <p className="text-sm opacity-80 mb-4">
              Not ready yet? Join the waitlist.
            </p>
            <div className="max-w-sm mx-auto bg-background text-foreground rounded-lg p-6">
              <WaitlistForm
                source="students"
                emailPlaceholder="you@university.edu"
                submitLabel="Join the Waitlist"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-4">
      {text}
    </span>
  );
}

function StudentFeature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
