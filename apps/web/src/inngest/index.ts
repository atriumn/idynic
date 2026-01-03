import { processResume } from "./functions/process-resume";
import { processStory } from "./functions/process-story";
import { processOpportunity } from "./functions/process-opportunity";
import { researchCompanyFunction } from "./functions/research-company";
import { processTailor } from "./functions/process-tailor";

// Export all Inngest functions for the serve handler
export const functions = [
  processResume,
  processStory,
  processOpportunity,
  researchCompanyFunction,
  processTailor,
];

// Re-export the client for triggering events
export { inngest } from "./client";
