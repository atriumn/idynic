import { processResume } from "./functions/process-resume";
import { processStory } from "./functions/process-story";

// Export all Inngest functions for the serve handler
export const functions = [processResume, processStory];

// Re-export the client for triggering events
export { inngest } from "./client";
