import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { dealScout } from "@/lib/inngest/functions/deal-scout";
import { scheduledBonusAlerts } from "@/lib/inngest/functions/scheduled-crons";
import { transferBonusMonitor } from "@/lib/inngest/functions/transfer-bonus-monitor";

// Create an API route that serves the Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dealScout,
    scheduledBonusAlerts,
    transferBonusMonitor,
  ],
});
