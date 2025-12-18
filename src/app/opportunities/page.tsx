import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OpportunitiesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Opportunities</h1>

      <Card>
        <CardHeader>
          <CardTitle>Track Your Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Add job opportunities to track and see how your profile matches
            each role.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Opportunity tracking coming in Phase 5.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
