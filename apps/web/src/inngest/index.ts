import { processResume } from "./functions/process-resume";
import { processStory } from "./functions/process-story";
import { processOpportunity } from "./functions/process-opportunity";

// Export all Inngest functions for the serve handler
export const functions = [processResume, processStory, processOpportunity];

// Re-export the client for triggering events
export { inngest } from "./client";
