import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function IdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Identity</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Welcome, {user?.email}! Upload a resume to start building your
            professional identity.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Resume upload coming in Phase 3.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
