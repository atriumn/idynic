import { describe, it, expect } from "vitest";
import {
  jaroWinklerSimilarity,
  findDuplicates,
  findMissingFields,
  runRuleChecks,
  sampleClaimsForEval,
  type ClaimForEval,
} from "@/lib/ai/eval/rule-checks";

describe("jaroWinklerSimilarity", () => {
  it("should return 1 for identical strings", () => {
    expect(jaroWinklerSimilarity("hello", "hello")).toBe(1);
  });

  it("should return 0 for completely different strings", () => {
    expect(jaroWinklerSimilarity("abc", "xyz")).toBe(0);
  });

  it("should return 0 for empty strings", () => {
    expect(jaroWinklerSimilarity("", "hello")).toBe(0);
    expect(jaroWinklerSimilarity("hello", "")).toBe(0);
  });

  it("should return high similarity for similar strings", () => {
    const similarity = jaroWinklerSimilarity(
      "React Development",
      "React Developer",
    );
    expect(similarity).toBeGreaterThan(0.85);
  });

  it("should return moderate similarity for related strings", () => {
    const similarity = jaroWinklerSimilarity("JavaScript", "TypeScript");
    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeLessThan(0.9);
  });

  it("should boost strings with common prefix", () => {
    const withPrefix = jaroWinklerSimilarity("React Native", "React Redux");
    const withoutPrefix = jaroWinklerSimilarity("Native React", "Redux React");
    expect(withPrefix).toBeGreaterThan(withoutPrefix);
  });
});

describe("findDuplicates", () => {
  it("should find exact duplicate labels", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("duplicate");
    expect(issues[0].claimId).toBe("2"); // newer one is the duplicate
    expect(issues[0].relatedClaimId).toBe("1");
  });

  it("should find similar labels above threshold", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React Development",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "React Developer",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("duplicate");
  });

  it("should not flag different labels as duplicates", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "Python",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should be case insensitive", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "REACT",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "react",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(1);
  });

  it("should handle empty claims array", () => {
    const issues = findDuplicates([]);
    expect(issues).toHaveLength(0);
  });

  it("should handle single claim", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should not flag different founder claims as duplicates", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "achievement",
        label: "Founded TechCorp",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "achievement",
        label: "Founded StartupXYZ",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should flag identical founder claims as duplicates", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "achievement",
        label: "Founded TechCorp",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "achievement",
        label: "Founded TechCorp",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(1);
  });

  it("should not flag co-founder vs founder for different companies", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "achievement",
        label: "Co-Founded StartupA",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "achievement",
        label: "Founded StartupB",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should not flag different AWS services as duplicates", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "AWS Lambda",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "AWS EC2",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should flag identical AWS services as duplicates", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "AWS Lambda",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "AWS Lambda",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(1);
  });

  it("should not flag short labels that are different as duplicates", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "React Native",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should not compare claims of different types", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React Development",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "achievement",
        label: "React Development",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(0);
  });

  it("should handle claims with null created_at", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: null,
      },
      {
        id: "2",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const issues = findDuplicates(claims);
    expect(issues).toHaveLength(1);
    expect(issues[0].claimId).toBe("2"); // newer one is the duplicate
  });
});

describe("findMissingFields", () => {
  it("should flag claims missing type", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: null,
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const issues = findMissingFields(claims);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("missing_field");
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("type");
  });

  it("should flag claims missing label", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const issues = findMissingFields(claims);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("missing_field");
    expect(issues[0].message).toContain("label");
  });

  it("should flag claims missing both type and label", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: null,
        label: "",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const issues = findMissingFields(claims);
    expect(issues).toHaveLength(2);
  });

  it("should not flag valid claims", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const issues = findMissingFields(claims);
    expect(issues).toHaveLength(0);
  });

  it("should handle whitespace-only labels", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "   ",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const issues = findMissingFields(claims);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("label");
  });
});

describe("runRuleChecks", () => {
  it("should combine duplicate and missing field checks", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-02",
      },
      {
        id: "3",
        type: null,
        label: "Python",
        description: null,
        created_at: "2024-01-03",
      },
    ];

    const issues = runRuleChecks(claims);
    expect(issues).toHaveLength(2); // 1 duplicate + 1 missing type
    expect(issues.some((i) => i.type === "duplicate")).toBe(true);
    expect(issues.some((i) => i.type === "missing_field")).toBe(true);
  });

  it("should return empty array for valid, unique claims", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "Python",
        description: null,
        created_at: "2024-01-02",
      },
      {
        id: "3",
        type: "achievement",
        label: "Led team of 5",
        description: null,
        created_at: "2024-01-03",
      },
    ];

    const issues = runRuleChecks(claims);
    expect(issues).toHaveLength(0);
  });
});

describe("sampleClaimsForEval", () => {
  it("should return all claims if count is less than max", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "React",
        description: null,
        created_at: "2024-01-01",
      },
      {
        id: "2",
        type: "skill",
        label: "Python",
        description: null,
        created_at: "2024-01-02",
      },
    ];

    const sampled = sampleClaimsForEval(claims, 5);
    expect(sampled).toHaveLength(2);
  });

  it("should limit to maxCount", () => {
    const claims: ClaimForEval[] = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      type: "skill",
      label: `Skill ${i}`,
      description: null,
      created_at: `2024-01-0${i + 1}`,
    }));

    const sampled = sampleClaimsForEval(claims, 5);
    expect(sampled).toHaveLength(5);
  });

  it("should prioritize claims with fewer evidence", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "Many Evidence",
        description: null,
        created_at: "2024-01-01",
        evidenceCount: 5,
      },
      {
        id: "2",
        type: "skill",
        label: "Few Evidence",
        description: null,
        created_at: "2024-01-01",
        evidenceCount: 1,
      },
      {
        id: "3",
        type: "skill",
        label: "No Evidence",
        description: null,
        created_at: "2024-01-01",
        evidenceCount: 0,
      },
    ];

    const sampled = sampleClaimsForEval(claims, 2);
    expect(sampled).toHaveLength(2);
    expect(sampled[0].id).toBe("3"); // No evidence first
    expect(sampled[1].id).toBe("2"); // Few evidence second
  });

  it("should prioritize newer claims when evidence count is equal", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "Old",
        description: null,
        created_at: "2024-01-01",
        evidenceCount: 1,
      },
      {
        id: "2",
        type: "skill",
        label: "New",
        description: null,
        created_at: "2024-01-10",
        evidenceCount: 1,
      },
    ];

    const sampled = sampleClaimsForEval(claims, 1);
    expect(sampled).toHaveLength(1);
    expect(sampled[0].id).toBe("2"); // Newer one first
  });

  it("should handle claims with undefined evidenceCount", () => {
    const claims: ClaimForEval[] = [
      {
        id: "1",
        type: "skill",
        label: "With Evidence",
        description: null,
        created_at: "2024-01-01",
        evidenceCount: 3,
      },
      {
        id: "2",
        type: "skill",
        label: "Unknown Evidence",
        description: null,
        created_at: "2024-01-01",
      },
    ];

    const sampled = sampleClaimsForEval(claims, 1);
    expect(sampled).toHaveLength(1);
    expect(sampled[0].id).toBe("2"); // Undefined treated as 0
  });
});
