/**
 * Claim & Tailoring Eval Framework
 *
 * Two evaluation systems:
 * 1. Claim Eval - Validates claims during resume/story processing
 * 2. Tailoring Eval - Catches hallucinations before user shares profiles
 */

export * from "./rule-checks";
export * from "./claim-grounding";
export * from "./tailoring-grounding";
export * from "./run-claim-eval";
