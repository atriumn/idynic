import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddOpportunityDialog } from "@/components/add-opportunity-dialog";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import Image from "next/image";

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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Target Roles</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Track your targets and assemble tailored evidence for every
            application.
          </p>
        </div>
        <AddOpportunityDialog />
      </div>

      {opportunities && opportunities.length > 0 ? (
        <OpportunityList initialOpportunities={opportunities} />
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 rounded-3xl bg-muted/10 border-dashed">
          <div className="relative h-48 w-80 mb-10 rounded-2xl overflow-hidden border bg-slate-950 shadow-2xl">
            <Image
              src="/images/how-it-works-3.png"
              alt="Assembly of tailored profiles"
              fill
              className="object-cover"
            />
          </div>
          <h2 className="text-2xl font-black mb-3">No targets yet</h2>
          <p className="text-muted-foreground mb-10 max-w-md text-lg">
            Add your first target role to see how your Master Record matches up
            and assemble a perfect application.
          </p>
          <AddOpportunityDialog />
        </div>
      )}
    </div>
  );
}
