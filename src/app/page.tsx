import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Your Smart Career Companion
        </h1>
        <p className="text-lg text-muted-foreground">
          Upload your resume, track job opportunities, and see how your
          experience matches each role. AI-powered insights to help you land
          your next opportunity.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/login">Get Started</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
