import { Inngest } from "inngest";

// Create the Inngest client
export const inngest = new Inngest({
  id: "idynic",
  // Event key is optional for development but required in production
  // It will be read from INNGEST_EVENT_KEY env var
});

// Type-safe event definitions
export type Events = {
  "resume/process": {
    data: {
      jobId: string;
      userId: string;
      filename: string;
      storagePath: string;
    };
  };
  "story/process": {
    data: {
      jobId: string;
      userId: string;
      text: string;
      contentHash: string;
    };
  };
  "opportunity/process": {
    data: {
      jobId: string;
      userId: string;
      url: string | null;
      description: string | null;
    };
  };
};
