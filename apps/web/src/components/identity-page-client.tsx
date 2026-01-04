"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Sparkles,
  List as ListIcon,
  Loader2,
  Eye,
  Wand2,
  TrendingUp,
  HelpCircle,
  AlertTriangle,
  Cuboid,
} from "lucide-react";
import { SkillClusters } from "@/components/skill-clusters";
import { IdentityClaimsList } from "@/components/identity-claims-list";
import { ClaimDetailPanel } from "@/components/claim-detail-panel";
import { UploadResumeModal } from "@/components/upload-resume-modal";
import { AddStoryModal } from "@/components/add-story-modal";
import { IdentityReflection } from "@/components/identity/identity-reflection";
import { HelpTooltip } from "@/components/help-tooltip";
import { useIdentityGraph } from "@/lib/hooks/use-identity-graph";
import { useIdentityReflection } from "@/lib/hooks/use-identity-reflection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { BetaGate } from "@/components/beta-gate";
import { EMPTY_STATE } from "@idynic/shared";

/** Parse **bold** markdown to React elements */
function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  );
}

const BETA_CODE_KEY = "idynic_beta_code";

type ViewType = "clusters" | "list";

interface IdentityPageClientProps {
  hasAnyClaims: boolean;
}

export function IdentityPageClient({ hasAnyClaims }: IdentityPageClientProps) {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [viewType, setViewType] = useState<ViewType>("list");
  const { data } = useIdentityGraph();
  const { data: reflectionData, isLoading: reflectionLoading } =
    useIdentityReflection();
  const betaCodeConsumed = useRef(false);

  // Beta access state
  const [betaAccessLoading, setBetaAccessLoading] = useState(true);
  const [hasBetaAccess, setHasBetaAccess] = useState(false);

  const checkBetaAccess = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setBetaAccessLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("beta_code_used")
      .eq("id", user.id)
      .single();

    setHasBetaAccess(!!profile?.beta_code_used);
    setBetaAccessLoading(false);
  }, []);

  // Check beta access and consume stored code on mount
  useEffect(() => {
    const init = async () => {
      // First try to consume any stored code
      if (!betaCodeConsumed.current) {
        const code = localStorage.getItem(BETA_CODE_KEY);
        if (code) {
          betaCodeConsumed.current = true;
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user) {
            await supabase.rpc("consume_beta_code", {
              input_code: code,
              user_id: user.id,
            });
            localStorage.removeItem(BETA_CODE_KEY);
          }
        }
      }

      // Then check beta access
      await checkBetaAccess();
    };

    init();
  }, [checkBetaAccess]);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const claimCount = data?.nodes.length ?? 0;
  const claimsWithIssues =
    data?.nodes.filter((n) => n.issues && n.issues.length > 0).length ?? 0;
  const showEmptyState = !hasAnyClaims && claimCount === 0;

  // Show loading while checking beta access
  if (betaAccessLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show beta gate if user doesn't have access
  if (!hasBetaAccess) {
    return <BetaGate onAccessGranted={checkBetaAccess} />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col min-h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="border-b bg-background">
          <div className="container mx-auto px-4 py-4 max-w-5xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Master Record</h1>
                <HelpTooltip helpKey="masterRecord" iconSize={16} />
              </div>
              {claimCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Cuboid className="w-3 h-3" />
                  {claimCount} blocks
                </Badge>
              )}
              {claimCount > 0 && claimsWithIssues > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">
                    {claimsWithIssues} issue{claimsWithIssues !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
            {/* View toggle */}
            {claimCount > 0 && !isMobile && (
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={viewType === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewType("list")}
                  title="List - Data view"
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewType === "clusters" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewType("clusters")}
                  title="Clusters - Skill similarity map"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="container mx-auto px-4 py-8 max-w-5xl flex-1">
          {/* Identity Reflection Hero */}
          {!showEmptyState && (
            <IdentityReflection
              data={reflectionData ?? null}
              isLoading={reflectionLoading}
            />
          )}

          {showEmptyState ? (
            <div className="mt-8 space-y-8">
              {/* Main CTA */}
              <div className="flex flex-col items-center justify-center text-center px-4 py-12 border rounded-lg border-dashed bg-muted/10">
                <div className="relative h-40 w-64 mb-8 rounded-lg overflow-hidden border bg-slate-950 shadow-md">
                  <Image
                    src="/images/how-it-works-1.png"
                    alt="Master Record construction"
                    fill
                    className="object-cover"
                  />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  Start building your Master Record
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md">
                  Upload your resume, reviews, or project docs to extract your
                  first <strong>Evidence Blocks</strong>.
                </p>
                <div className="flex gap-3">
                  <UploadResumeModal />
                  <AddStoryModal />
                </div>
              </div>

              {/* What claims unlock */}
              <div className="grid md:grid-cols-3 gap-4">
                {EMPTY_STATE.features.map((feature, i) => {
                  const icons = [Eye, Wand2, TrendingUp];
                  const Icon = icons[i];
                  return (
                    <div
                      key={feature.title}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">{feature.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Help section */}
              <div className="rounded-lg border bg-muted/30 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                  <h3 className="font-medium">Common questions</h3>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {Object.values(EMPTY_STATE.help).map((item) => (
                    <div key={item.title}>
                      <h4 className="text-sm font-medium mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {parseBold(item.content)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : isMobile ? (
            <div className="py-4">
              <IdentityClaimsList
                claims={(data?.nodes || []).map((node) => ({
                  ...node,
                  created_at: "",
                  updated_at: "",
                  user_id: "",
                  embedding: null,
                  source: null,
                  issues: node.issues,
                  claim_evidence: (node.claim_evidence || []).map((ce) => {
                    const doc = ce.evidence?.document_id
                      ? data?.documents.find(
                          (d) => d.id === ce.evidence?.document_id,
                        )
                      : null;
                    return {
                      strength: ce.strength,
                      evidence: ce.evidence
                        ? {
                            text: ce.evidence.text,
                            evidence_type: ce.evidence.evidence_type,
                            document: doc
                              ? {
                                  id: doc.id,
                                  filename: doc.name,
                                  type: doc.type,
                                  createdAt: doc.createdAt,
                                }
                              : null,
                          }
                        : null,
                    };
                  }),
                }))}
              />
            </div>
          ) : (
            <div
              className={
                viewType === "list"
                  ? ""
                  : "h-[600px] border rounded-xl bg-background shadow-sm overflow-hidden"
              }
            >
              {viewType === "clusters" ? (
                <SkillClusters
                  onSelectClaim={setSelectedClaimId}
                  selectedClaimId={selectedClaimId}
                />
              ) : (
                <IdentityClaimsList
                  claims={(data?.nodes || []).map((node) => ({
                    ...node,
                    created_at: "",
                    updated_at: "",
                    user_id: "",
                    embedding: null,
                    source: null,
                    issues: node.issues,
                    claim_evidence: (node.claim_evidence || []).map((ce) => {
                      const doc = ce.evidence?.document_id
                        ? data?.documents.find(
                            (d) => d.id === ce.evidence?.document_id,
                          )
                        : null;
                      return {
                        strength: ce.strength,
                        evidence: ce.evidence
                          ? {
                              text: ce.evidence.text,
                              evidence_type: ce.evidence.evidence_type,
                              document: doc
                                ? {
                                    id: doc.id,
                                    filename: doc.name,
                                    type: doc.type,
                                    createdAt: doc.createdAt,
                                  }
                                : null,
                            }
                          : null,
                      };
                    }),
                  }))}
                />
              )}
            </div>
          )}
        </div>

        {/* Side panel */}
        <ClaimDetailPanel
          claimId={selectedClaimId}
          onClose={() => setSelectedClaimId(null)}
        />
      </div>
    </TooltipProvider>
  );
}
