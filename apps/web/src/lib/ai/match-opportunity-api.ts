import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbeddings } from "./embeddings";
import type { Database } from "@/lib/supabase/types";

type RequirementType = "education" | "certification" | "skill" | "experience";

interface ClassifiedRequirement {
  text: string;
  type: RequirementType;
}

interface Requirement {
  text: string;
  category: "mustHave" | "niceToHave";
  type: RequirementType;
}

interface MatchedClaim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
  similarity: number;
}

interface RequirementMatch {
  requirement: Requirement;
  matches: MatchedClaim[];
  bestMatch: MatchedClaim | null;
}

export interface MatchResult {
  overallScore: number;
  mustHaveScore: number;
  niceToHaveScore: number;
  requirementMatches: RequirementMatch[];
  gaps: Requirement[];
  strengths: RequirementMatch[];
}

const MATCH_THRESHOLD = 0.4;

const VALID_CLAIM_TYPES: Record<RequirementType, string[]> = {
  education: ["education"],
  certification: ["certification"],
  skill: ["skill", "achievement"],
  experience: ["skill", "achievement", "attribute"],
};

export async function computeOpportunityMatchesWithClient(
  supabase: SupabaseClient<Database>,
  opportunityId: string,
  userId: string,
): Promise<MatchResult> {
  // Get opportunity requirements
  const { data: opportunity } = await supabase
    .from("opportunities")
    .select("requirements")
    .eq("id", opportunityId)
    .single();

  if (!opportunity?.requirements) {
    return {
      overallScore: 0,
      mustHaveScore: 0,
      niceToHaveScore: 0,
      requirementMatches: [],
      gaps: [],
      strengths: [],
    };
  }

  const reqs = opportunity.requirements as {
    mustHave?: ClassifiedRequirement[] | string[];
    niceToHave?: ClassifiedRequirement[] | string[];
  };

  const normalizeReqs = (
    items: ClassifiedRequirement[] | string[] | undefined,
    category: "mustHave" | "niceToHave",
  ): Requirement[] => {
    if (!items) return [];
    return items.map((item) => {
      if (typeof item === "string") {
        return { text: item, category, type: "skill" as RequirementType };
      }
      return { text: item.text, category, type: item.type || "skill" };
    });
  };

  const requirements: Requirement[] = [
    ...normalizeReqs(reqs.mustHave, "mustHave"),
    ...normalizeReqs(reqs.niceToHave, "niceToHave"),
  ];

  if (requirements.length === 0) {
    return {
      overallScore: 0,
      mustHaveScore: 0,
      niceToHaveScore: 0,
      requirementMatches: [],
      gaps: [],
      strengths: [],
    };
  }

  const embeddings = await generateEmbeddings(requirements.map((r) => r.text));
  const requirementMatches: RequirementMatch[] = [];

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const embedding = embeddings[i];

    const { data: matches, error } = await supabase.rpc(
      "match_identity_claims",
      {
        query_embedding: embedding as unknown as string,
        match_user_id: userId,
        match_threshold: MATCH_THRESHOLD,
        match_count: 10,
      },
    );

    if (error) {
      console.error(`Error matching requirement "${req.text}":`, error);
    }

    const validClaimTypes = VALID_CLAIM_TYPES[req.type];
    const matchedClaims: MatchedClaim[] = (matches || [])
      .filter((m: { type: string }) => validClaimTypes.includes(m.type))
      .slice(0, 3)
      .map(
        (m: {
          id: string;
          type: string;
          label: string;
          description: string | null;
          confidence: number;
          similarity: number;
        }) => ({
          id: m.id,
          type: m.type,
          label: m.label,
          description: m.description,
          confidence: m.confidence,
          similarity: m.similarity,
        }),
      );

    requirementMatches.push({
      requirement: req,
      matches: matchedClaims,
      bestMatch: matchedClaims[0] || null,
    });
  }

  const mustHaveMatches = requirementMatches.filter(
    (rm) => rm.requirement.category === "mustHave" && rm.bestMatch,
  );
  const niceToHaveMatches = requirementMatches.filter(
    (rm) => rm.requirement.category === "niceToHave" && rm.bestMatch,
  );

  const totalMustHave = requirementMatches.filter(
    (rm) => rm.requirement.category === "mustHave",
  ).length;
  const totalNiceToHave = requirementMatches.filter(
    (rm) => rm.requirement.category === "niceToHave",
  ).length;

  const mustHaveScore =
    totalMustHave > 0
      ? Math.round((mustHaveMatches.length / totalMustHave) * 100)
      : 100;
  const niceToHaveScore =
    totalNiceToHave > 0
      ? Math.round((niceToHaveMatches.length / totalNiceToHave) * 100)
      : 100;

  const overallScore = Math.round(mustHaveScore * 0.7 + niceToHaveScore * 0.3);

  const gaps = requirementMatches
    .filter((rm) => !rm.bestMatch)
    .map((rm) => rm.requirement);

  const strengths = requirementMatches
    .filter((rm) => rm.bestMatch && rm.bestMatch.similarity > 0.4)
    .sort(
      (a, b) => (b.bestMatch?.similarity || 0) - (a.bestMatch?.similarity || 0),
    );

  return {
    overallScore,
    mustHaveScore,
    niceToHaveScore,
    requirementMatches,
    gaps,
    strengths,
  };
}
