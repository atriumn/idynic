import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddOpportunityDialog } from "@/components/add-opportunity-dialog";
import { OpportunityCard } from "@/components/opportunity-card";
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Opportunities</h1>
        <AddOpportunityDialog />
      </div>

      {opportunities && opportunities.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No opportunities yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Add job postings to track opportunities and see how your profile matches.
          </p>
          <AddOpportunityDialog />
        </div>
      )}
    </div>
  );
}
