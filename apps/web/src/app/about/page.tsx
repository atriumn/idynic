import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] py-20 px-4">
      <div className="container mx-auto max-w-4xl space-y-24">
        {/* ... Hero and Problem sections ... */}

        {/* The Solution ... */}

        {/* Lifestyle Image Section */}
        <div className="relative h-[300px] md:h-[450px] w-full rounded-2xl overflow-hidden border shadow-xl">
          <Image
            src="/images/lifestyle-desktop.png"
            alt="Productive professional using Idynic in a bright, modern office"
            fill
            className="object-cover"
          />
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
