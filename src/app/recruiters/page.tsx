import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import Image from "next/image";
import { RecruiterWaitlistForm } from "@/components/recruiter-waitlist-form";

export default function RecruitersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image src="/logo.svg" alt="Idynic" width={48} height={48} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Idynic for Recruiters &amp; Hiring Managers
          </h1>
          <p className="text-lg text-muted-foreground">
            Coming soon: Post your roles and discover pre-qualified candidates
            with tailored profiles matched to your needs.
          </p>
        </div>

        <Card className="mb-8">
          <CardContent className="pt-6">
            <RecruiterWaitlistForm />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Feature>View candidate profiles tailored to your role</Feature>
          <Feature>See verified skills and work history</Feature>
          <Feature>Direct connection to candidates</Feature>
          <Feature>Skip the resume pile - find the right fit faster</Feature>
        </div>
      </div>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
        <Check className="h-4 w-4 text-green-600" />
      </div>
      <span className="text-muted-foreground">{children}</span>
    </div>
  );
}
