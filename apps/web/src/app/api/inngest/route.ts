import { serve } from "inngest/next";
import { inngest, functions } from "@/inngest";

// Create an API route that serves the Inngest handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
