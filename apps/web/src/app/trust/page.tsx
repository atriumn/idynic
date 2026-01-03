import Link from "next/link";
import { Shield, Lock, Eye, FileCheck, TrendingDown, Info } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TrustPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] py-20 px-4">
      <div className="container mx-auto max-w-4xl space-y-24">
        {/* Hero */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Shield className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            How Idynic Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We believe your career data should be private, verifiable, and
            transparent. Here is the engineering behind our platform.
          </p>
        </div>

        {/* Section 1: Privacy */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Lock className="w-6 h-6 text-primary" />
            Privacy by Design
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl border bg-card text-card-foreground">
              <h3 className="font-semibold text-lg mb-2">You own the data</h3>
              <p className="text-muted-foreground">
                Your documents, parsed data, and profile history belong to you.
                You can export them or delete your account at any time. We do
                not sell your personal data to recruiters or third parties.
              </p>
            </div>
            <div className="p-6 rounded-xl border bg-card text-card-foreground">
              <h3 className="font-semibold text-lg mb-2">
                Private until shared
              </h3>
              <p className="text-muted-foreground">
                Your profile is invisible by default. Recruiters and companies
                can only see what you explicitly choose to share via a generated
                link. You can revoke access to any link instantly.
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Verification */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <FileCheck className="w-6 h-6 text-primary" />
            The Confidence Score
          </h2>
          <div className="prose dark:prose-invert max-w-none text-muted-foreground">
            <p>
              Resume inflation is a real problem. To solve it, we don&apos;t
              just accept every claim as fact. Instead, we assign a{" "}
              <strong>Confidence Score</strong> to every extracted skill and
              achievement.
            </p>
            <p>
              This score is calculated based on the{" "}
              <strong>quality of evidence</strong> (e.g., a performance review
              weighs more than a self-written resume) and the{" "}
              <strong>recency</strong> of the experience.
            </p>
          </div>

          <div className="border rounded-xl p-8 bg-slate-50 dark:bg-slate-900/50 space-y-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-primary" />
                Recency Decay
              </h3>
              <p className="text-muted-foreground mb-4">
                Skills fade if they aren&apos;t used. Our algorithm applies an
                exponential decay function to older experiences, ensuring your
                profile reflects your <em>current</em> capabilities, not just
                your history.
              </p>
              <div className="font-mono bg-background p-4 rounded-lg border text-sm overflow-x-auto">
                decay_factor = 0.5 ^ (years_old / half_life)
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">
                Half-Lives by Evidence Type
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Half-life</TableHead>
                    <TableHead>Rationale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Skill</TableCell>
                    <TableCell>4 years</TableCell>
                    <TableCell>
                      Technology stacks and best practices evolve rapidly.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Achievement</TableCell>
                    <TableCell>7 years</TableCell>
                    <TableCell>
                      Business impact is durable, but market context changes.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Attribute</TableCell>
                    <TableCell>15 years</TableCell>
                    <TableCell>
                      Core character traits (e.g., leadership) are stable.
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Education</TableCell>
                    <TableCell>∞</TableCell>
                    <TableCell>
                      Degrees and foundational knowledge do not expire.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-background rounded-xl border p-6">
              <h4 className="font-semibold mb-6 flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                See it in action
              </h4>

              <Tabs defaultValue="engineering" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="engineering">Engineering</TabsTrigger>
                  <TabsTrigger value="product">Product</TabsTrigger>
                  <TabsTrigger value="marketing">Marketing</TabsTrigger>
                  <TabsTrigger value="students">Students</TabsTrigger>
                </TabsList>

                {/* Tab 1: Engineering */}
                <TabsContent value="engineering" className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Skill</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">COBOL</Badge>
                            </div>
                          </TableCell>
                          <TableCell>2003</TableCell>
                          <TableCell>22 years</TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            2%
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">React</Badge>
                            </div>
                          </TableCell>
                          <TableCell>2024</TableCell>
                          <TableCell>1 year</TableCell>
                          <TableCell className="text-right font-mono text-green-500">
                            84%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    * Impact: A claim of &ldquo;Expert COBOL Developer&rdquo;
                    from 2003 carries almost no weight today unless supported by
                    new evidence.
                  </p>
                </TabsContent>

                {/* Tab 2: Product Management */}
                <TabsContent value="product" className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Skill</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Waterfall</Badge>
                            </div>
                          </TableCell>
                          <TableCell>2012</TableCell>
                          <TableCell>13 years</TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            10%
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">AI Strategy</Badge>
                            </div>
                          </TableCell>
                          <TableCell>2024</TableCell>
                          <TableCell>1 year</TableCell>
                          <TableCell className="text-right font-mono text-green-500">
                            84%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    * Impact: Methodologies evolve. Your experience with modern
                    AI workflows is valued significantly higher than outdated
                    process management.
                  </p>
                </TabsContent>

                {/* Tab 3: Marketing */}
                <TabsContent value="marketing" className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Skill</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">TV Ad Buying</Badge>
                            </div>
                          </TableCell>
                          <TableCell>2010</TableCell>
                          <TableCell>15 years</TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            7%
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">TikTok Growth</Badge>
                            </div>
                          </TableCell>
                          <TableCell>2024</TableCell>
                          <TableCell>1 year</TableCell>
                          <TableCell className="text-right font-mono text-green-500">
                            84%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    * Impact: Marketing channels die fast. Recent success on
                    current platforms outweighs legacy channel experience.
                  </p>
                </TabsContent>

                {/* Tab 4: Students */}
                <TabsContent value="students" className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Skill</TableHead>
                          <TableHead>Last Used</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead className="text-right">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Team Leadership</Badge>
                              <span className="text-xs text-muted-foreground">
                                (HS Sports)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>2019</TableCell>
                          <TableCell>6 years</TableCell>
                          <TableCell className="text-right font-mono text-red-500">
                            15%
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="default">Full Stack Dev</Badge>
                              <span className="text-xs text-muted-foreground">
                                (Capstone)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>2025</TableCell>
                          <TableCell>0 years</TableCell>
                          <TableCell className="text-right font-mono text-green-500">
                            100%
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    * Impact: Employers hire for current capability. Your recent
                    hackathon or capstone project outweighs high school
                    achievements, no matter how impressive they were at the
                    time.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Section 3: Transparency */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Eye className="w-6 h-6 text-primary" />
            No &ldquo;Black Box&rdquo; AI
          </h2>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Many AI tools hallucinate or exaggerate. We prevent this by
                treating AI as an <strong>extraction engine</strong>, not a
                creative writer.
              </p>
              <ul className="space-y-2 text-muted-foreground list-disc pl-5">
                <li>
                  We use LLMs to identify structured data from unstructured
                  text.
                </li>
                <li>
                  We do <strong>not</strong> allow the AI to invent experience.
                </li>
                <li>
                  Every &ldquo;Evidence Block&rdquo; must be traceable to an
                  uploaded file or a user-written story.
                </li>
              </ul>
            </div>
            <div className="p-6 bg-muted/50 rounded-xl border">
              <h4 className="font-semibold mb-2">Our Promise</h4>
              <p className="italic text-muted-foreground">
                &ldquo;If you can&apos;t prove it, we won&apos;t show it.&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pt-12 pb-8">
          <h2 className="text-2xl font-bold mb-6">
            Ready to build your verified record?
          </h2>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/login">Start Building</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/about">About Us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
