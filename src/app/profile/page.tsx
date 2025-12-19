import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileContent } from "@/components/profile/profile-content";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
        <p className="text-muted-foreground">
          Your Profile is the source of truth about your career. This data feeds into every
          tailored resume. Edit your work history, contact info, skills, and certifications here.
          Changes apply to all future resumes.
        </p>
      </div>

      <ProfileContent />
    </div>
  );
}
