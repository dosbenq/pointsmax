import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { bonusCurator } from "@/lib/inngest/functions/bonus-curator";
import { dealScout } from "@/lib/inngest/functions/deal-scout";
import { scheduledBonusAlerts, scheduledValuationsUpdate } from "@/lib/inngest/functions/scheduled-crons";
import { transferBonusMonitor } from "@/lib/inngest/functions/transfer-bonus-monitor";
import { indiaValuationsScraper } from "@/lib/inngest/functions/india-valuations-scraper";
import { valuationRefresh } from "@/lib/inngest/functions/valuation-refresh";

// Create an API route that serves the Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    bonusCurator,
    dealScout,
    scheduledBonusAlerts,
    scheduledValuationsUpdate,
    transferBonusMonitor,
    indiaValuationsScraper,
    valuationRefresh,
  ],
});
