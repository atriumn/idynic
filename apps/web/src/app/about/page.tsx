import Link from "next/link";
import { Layers, Fingerprint, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] py-20 px-4">
      <div className="container mx-auto max-w-4xl space-y-24">
        {/* Hero */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Own Your Career Story
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Idynic brings your scattered career history into one place—and puts
            it to work for you.
          </p>
        </div>

        {/* The Problem */}
        <div className="space-y-8">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-center">
            The reality of job searching
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Scattered identity</h3>
              <p className="text-muted-foreground">
                Your career lives in fragments—old resumes, LinkedIn updates,
                performance reviews, half-remembered project wins. When
                opportunity knocks, you&apos;re scrambling to piece it together.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Application fatigue</h3>
              <p className="text-muted-foreground">
                Every job wants a tailored pitch. So you rewrite, reformat, and
                second-guess yourself—over and over. It&apos;s exhausting, and
                it shouldn&apos;t be this hard.
              </p>
            </div>
          </div>
        </div>

        {/* The Solution */}
        <div className="space-y-12">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-center">
            How Idynic helps
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Capture everything</h3>
              <p className="text-muted-foreground text-sm">
                Upload resumes, write stories, add project docs. Idynic extracts
                and organizes your career evidence automatically.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Fingerprint className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Build your identity</h3>
              <p className="text-muted-foreground text-sm">
                Your skills, impact, and experience connect into a unified
                career identity—one source of truth you control.
              </p>
            </div>
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Tailor in seconds</h3>
              <p className="text-muted-foreground text-sm">
                Paste a job description. Get a customized profile with talking
                points matched to what they&apos;re looking for.
              </p>
            </div>
          </div>
        </div>

        {/* The Vision */}
        <div className="space-y-6 text-center max-w-2xl mx-auto">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            What we believe
          </h2>
          <p className="text-lg text-muted-foreground">
            Your career is more than a list of job titles. It&apos;s the
            problems you&apos;ve solved, the impact you&apos;ve made, and the
            skills you&apos;ve built along the way. We&apos;re building Idynic
            to help you see that full picture—and show it to the world on your
            terms.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center space-y-6 pb-12">
          <h2 className="text-3xl font-bold">Ready to take control?</h2>
          <Button size="lg" asChild>
            <Link href="/login">Get Started</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Free to start. Your data stays yours.
          </p>
        </div>
      </div>
    </div>
  );
}
