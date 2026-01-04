import { describe, it, expect } from "vitest";
import { extractHighlights } from "@/lib/resume/extract-highlights";
import type { ExtractedEvidence } from "@/lib/ai/extract-evidence";
import type { ExtractedJob } from "@/lib/ai/extract-work-history";

describe("extractHighlights", () => {
  const createEvidence = (
    overrides: Partial<ExtractedEvidence> = {},
  ): ExtractedEvidence => ({
    text: "Sample evidence",
    type: "accomplishment",
    context: null,
    sourceType: "resume",
    ...overrides,
  });

  const createJob = (overrides: Partial<ExtractedJob> = {}): ExtractedJob => ({
    company: "Acme Corp",
    company_domain: "acmecorp.com",
    title: "Engineer",
    start_date: "2020-01-01",
    end_date: "2023-01-01",
    location: null,
    summary: null,
    entry_type: "work",
    ...overrides,
  });

  describe("notable companies", () => {
    it("should highlight work at notable companies", () => {
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Google",
          start_date: "2020-01-01",
          end_date: "2023-01-01",
        }),
      ];

      const highlights = extractHighlights([], workHistory);

      expect(highlights).toHaveLength(1);
      expect(highlights[0].text).toContain("Google");
      expect(highlights[0].text).toContain("3 years");
      expect(highlights[0].type).toBe("company");
    });

    it("should not highlight non-notable companies", () => {
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Random Startup",
          start_date: "2020-01-01",
          end_date: "2023-01-01",
        }),
      ];

      const highlights = extractHighlights([], workHistory);

      expect(highlights).toHaveLength(0);
    });

    it("should handle various notable company names", () => {
      const companies = ["Meta", "AMAZON", "apple", "Microsoft", "Netflix"];

      for (const company of companies) {
        const workHistory: ExtractedJob[] = [
          createJob({
            company,
            start_date: "2021-01-01",
            end_date: "2023-01-01",
          }),
        ];
        const highlights = extractHighlights([], workHistory);
        expect(highlights.length).toBeGreaterThan(0);
        expect(highlights[0].type).toBe("company");
      }
    });

    it("should not include tenure less than 1 year", () => {
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Google",
          start_date: "2023-06-01",
          end_date: "2023-12-01",
        }),
      ];

      const highlights = extractHighlights([], workHistory);

      expect(highlights).toHaveLength(0);
    });

    it("should handle jobs without start date", () => {
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Google",
          start_date: undefined as unknown as string,
        }),
      ];

      const highlights = extractHighlights([], workHistory);

      expect(highlights).toHaveLength(0);
    });

    it("should handle current jobs (no end date)", () => {
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 3;
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Meta",
          start_date: `${startYear}-01-01`,
          end_date: undefined,
        }),
      ];

      const highlights = extractHighlights([], workHistory);

      expect(highlights).toHaveLength(1);
      expect(highlights[0].text).toContain("3 years");
    });
  });

  describe("certifications", () => {
    it("should include certifications as highlights", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({
          text: "AWS Solutions Architect",
          type: "certification",
        }),
        createEvidence({ text: "PMP Certified", type: "certification" }),
      ];

      const highlights = extractHighlights(evidence, []);

      expect(highlights).toHaveLength(2);
      expect(highlights[0].type).toBe("certification");
      expect(highlights[1].type).toBe("certification");
    });
  });

  describe("education", () => {
    it("should include education as highlights", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({
          text: "MS in Computer Science, Stanford",
          type: "education",
        }),
        createEvidence({ text: "BS in Engineering, MIT", type: "education" }),
      ];

      const highlights = extractHighlights(evidence, []);

      expect(highlights).toHaveLength(2);
      expect(highlights[0].type).toBe("education");
      expect(highlights[1].type).toBe("education");
    });
  });

  describe("quantified achievements", () => {
    it("should include achievements with numbers", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({
          text: "Increased sales by 50%",
          type: "accomplishment",
        }),
        createEvidence({
          text: "Led team of 10 engineers",
          type: "accomplishment",
        }),
      ];

      const highlights = extractHighlights(evidence, []);

      expect(highlights).toHaveLength(2);
      expect(highlights[0].type).toBe("achievement");
      expect(highlights[1].type).toBe("achievement");
    });

    it("should not include achievements without numbers", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({
          text: "Improved code quality",
          type: "accomplishment",
        }),
        createEvidence({
          text: "Enhanced team collaboration",
          type: "accomplishment",
        }),
      ];

      const highlights = extractHighlights(evidence, []);

      expect(highlights).toHaveLength(0);
    });

    it("should limit quantified achievements to 3", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({
          text: "Achievement 1 with 100%",
          type: "accomplishment",
        }),
        createEvidence({
          text: "Achievement 2 with 200%",
          type: "accomplishment",
        }),
        createEvidence({
          text: "Achievement 3 with 300%",
          type: "accomplishment",
        }),
        createEvidence({
          text: "Achievement 4 with 400%",
          type: "accomplishment",
        }),
        createEvidence({
          text: "Achievement 5 with 500%",
          type: "accomplishment",
        }),
      ];

      const highlights = extractHighlights(evidence, []);
      const achievementHighlights = highlights.filter(
        (h) => h.type === "achievement",
      );

      expect(achievementHighlights).toHaveLength(3);
    });

    it("should truncate long achievements", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({
          text: "This is a very long achievement description that should be truncated because it exceeds the maximum length of 60 characters with 100 improvements",
          type: "accomplishment",
        }),
      ];

      const highlights = extractHighlights(evidence, []);

      expect(highlights).toHaveLength(1);
      expect(highlights[0].text.length).toBeLessThanOrEqual(60);
      expect(highlights[0].text).toContain("...");
    });
  });

  describe("combined highlights", () => {
    it("should combine all types of highlights", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({ text: "AWS Certified", type: "certification" }),
        createEvidence({ text: "PhD in CS", type: "education" }),
        createEvidence({ text: "Led 50 projects", type: "accomplishment" }),
      ];
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Google",
          start_date: "2019-01-01",
          end_date: "2023-01-01",
        }),
      ];

      const highlights = extractHighlights(evidence, workHistory);

      expect(highlights.length).toBeGreaterThanOrEqual(4);
      expect(highlights.some((h) => h.type === "company")).toBe(true);
      expect(highlights.some((h) => h.type === "certification")).toBe(true);
      expect(highlights.some((h) => h.type === "education")).toBe(true);
      expect(highlights.some((h) => h.type === "achievement")).toBe(true);
    });

    it("should limit total highlights to 6", () => {
      const evidence: ExtractedEvidence[] = [
        createEvidence({ text: "Cert 1", type: "certification" }),
        createEvidence({ text: "Cert 2", type: "certification" }),
        createEvidence({ text: "Edu 1", type: "education" }),
        createEvidence({ text: "Edu 2", type: "education" }),
        createEvidence({ text: "Ach 1 with 10%", type: "accomplishment" }),
        createEvidence({ text: "Ach 2 with 20%", type: "accomplishment" }),
        createEvidence({ text: "Ach 3 with 30%", type: "accomplishment" }),
      ];
      const workHistory: ExtractedJob[] = [
        createJob({
          company: "Google",
          start_date: "2019-01-01",
          end_date: "2023-01-01",
        }),
        createJob({
          company: "Meta",
          start_date: "2015-01-01",
          end_date: "2019-01-01",
        }),
      ];

      const highlights = extractHighlights(evidence, workHistory);

      expect(highlights).toHaveLength(6);
    });
  });

  describe("empty inputs", () => {
    it("should handle empty evidence and work history", () => {
      const highlights = extractHighlights([], []);

      expect(highlights).toHaveLength(0);
    });
  });
});
