import { createClient } from "@/lib/supabase/server";
import { generateEmbeddings } from "./embeddings";

type RequirementType = "education" | "certification" | "skill" | "experience";

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

interface MatchResult {
  overallScore: number;
  mustHaveScore: number;
  niceToHaveScore: number;
  requirementMatches: RequirementMatch[];
  gaps: Requirement[];
  strengths: RequirementMatch[];
}

const MATCH_THRESHOLD = 0.46;

// Keywords to classify requirement types
const EDUCATION_KEYWORDS = [
  "degree", "bachelor", "master", "phd", "mba", "bs", "ba", "ms", "ma",
  "university", "college", "graduate", "undergraduate", "diploma",
  "computer science", "engineering degree", "business degree"
];

const CERTIFICATION_KEYWORDS = [
  "certified", "certification", "certificate", "license", "licensed",
  "aws certified", "pmp", "cpa", "cissp", "ccna", "scrum master",
  "google certified", "azure certified"
];

// Claim types that can match each requirement type
const VALID_CLAIM_TYPES: Record<RequirementType, string[]> = {
  education: ["education"],
  certification: ["certification"],
  skill: ["skill", "achievement"],
  experience: ["skill", "achievement", "attribute"],
};

function classifyRequirement(text: string): RequirementType {
  const lower = text.toLowerCase();

  // Check for education keywords
  if (EDUCATION_KEYWORDS.some(kw => lower.includes(kw))) {
    return "education";
  }

  // Check for certification keywords
  if (CERTIFICATION_KEYWORDS.some(kw => lower.includes(kw))) {
    return "certification";
  }

  // Check for experience patterns (years of experience)
  if (/\d+\+?\s*years?/.test(lower) || lower.includes("experience")) {
    return "experience";
  }

  // Default to skill
  return "skill";
}

export async function computeOpportunityMatches(
  opportunityId: string,
  userId: string
): Promise<MatchResult> {
  const supabase = await createClient();

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
    mustHave?: string[];
    niceToHave?: string[];
  };

  // Build requirements list with type classification
  const requirements: Requirement[] = [
    ...(reqs.mustHave || []).map((text) => ({
      text,
      category: "mustHave" as const,
      type: classifyRequirement(text),
    })),
    ...(reqs.niceToHave || []).map((text) => ({
      text,
      category: "niceToHave" as const,
      type: classifyRequirement(text),
    })),
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

  // Generate embeddings for all requirements
  const embeddings = await generateEmbeddings(requirements.map((r) => r.text));

  // Find matches for each requirement
  const requirementMatches: RequirementMatch[] = [];

  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const embedding = embeddings[i];

    // Call the match_identity_claims function
    const { data: matches } = await supabase.rpc("match_identity_claims", {
      query_embedding: embedding as unknown as string,
      match_user_id: userId,
      match_threshold: MATCH_THRESHOLD,
      match_count: 10, // Get more candidates, then filter by type
    });

    // Filter matches by valid claim types for this requirement type
    const validClaimTypes = VALID_CLAIM_TYPES[req.type];
    const matchedClaims: MatchedClaim[] = (matches || [])
      .filter((m: { type: string }) => validClaimTypes.includes(m.type))
      .slice(0, 3) // Keep top 3 after filtering
      .map((m: {
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
      }));

    requirementMatches.push({
      requirement: req,
      matches: matchedClaims,
      bestMatch: matchedClaims[0] || null,
    });
  }

  // Calculate scores
  const mustHaveMatches = requirementMatches.filter(
    (rm) => rm.requirement.category === "mustHave" && rm.bestMatch
  );
  const niceToHaveMatches = requirementMatches.filter(
    (rm) => rm.requirement.category === "niceToHave" && rm.bestMatch
  );

  const totalMustHave = requirementMatches.filter(
    (rm) => rm.requirement.category === "mustHave"
  ).length;
  const totalNiceToHave = requirementMatches.filter(
    (rm) => rm.requirement.category === "niceToHave"
  ).length;

  const mustHaveScore = totalMustHave > 0
    ? Math.round((mustHaveMatches.length / totalMustHave) * 100)
    : 100;
  const niceToHaveScore = totalNiceToHave > 0
    ? Math.round((niceToHaveMatches.length / totalNiceToHave) * 100)
    : 100;

  // Overall score weights must-have more heavily (70/30)
  const overallScore = Math.round(mustHaveScore * 0.7 + niceToHaveScore * 0.3);

  // Identify gaps (requirements without good matches)
  const gaps = requirementMatches
    .filter((rm) => !rm.bestMatch)
    .map((rm) => rm.requirement);

  // Identify strengths (good matches, sorted by similarity)
  const strengths = requirementMatches
    .filter((rm) => rm.bestMatch && rm.bestMatch.similarity > 0.4)
    .sort((a, b) => (b.bestMatch?.similarity || 0) - (a.bestMatch?.similarity || 0));

  return {
    overallScore,
    mustHaveScore,
    niceToHaveScore,
    requirementMatches,
    gaps,
    strengths,
  };
}
