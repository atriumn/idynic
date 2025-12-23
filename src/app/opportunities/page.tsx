import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddOpportunityDialog } from "@/components/add-opportunity-dialog";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { Briefcase } from "lucide-react";

export default async function OpportunitiesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: opportunities } = await supabase
    .from("opportunities")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your job applications and tailored profiles.
          </p>
        </div>
        <AddOpportunityDialog />
      </div>

      {opportunities && opportunities.length > 0 ? (
        <OpportunityList initialOpportunities={opportunities} />
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center border rounded-xl bg-muted/10 border-dashed">
          <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
            <Briefcase className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No opportunities yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md">
            Start tracking your job search by adding your first opportunity. We&apos;ll help you analyze the fit and tailor your profile.
          </p>
          <AddOpportunityDialog />
        </div>
      )}
    </div>
  );
}
