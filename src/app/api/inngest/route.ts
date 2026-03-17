import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { bonusCurator } from "@/lib/inngest/functions/bonus-curator";
import { dealScout } from "@/lib/inngest/functions/deal-scout";
import { bookingGuide } from "@/lib/inngest/functions/booking-guide";
import { workflowHealthcheck } from "@/lib/inngest/functions/workflow-healthcheck";
import { youtubeLearner } from "@/lib/inngest/functions/youtube-learner";
import { scheduledBonusAlerts, scheduledValuationsUpdate, scheduledYoutubeIngestion } from "@/lib/inngest/functions/scheduled-crons";
import { linkChecker } from "@/lib/inngest/functions/link-checker";
import { onboardingEmails } from "@/lib/inngest/functions/onboarding-emails";
import { transferBonusMonitor } from "@/lib/inngest/functions/transfer-bonus-monitor";
import { indiaValuationsScraper } from "@/lib/inngest/functions/india-valuations-scraper";
import { valuationRefresh } from "@/lib/inngest/functions/valuation-refresh";
import { catalogHealthDigest } from "@/lib/inngest/functions/catalog-health-digest";
import { weeklyDigest } from "@/lib/inngest/functions/weekly-digest";

// Create an API route that serves the Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    bonusCurator,
    dealScout,
    bookingGuide,
    workflowHealthcheck,
    youtubeLearner,
    scheduledBonusAlerts,
    scheduledValuationsUpdate,
    scheduledYoutubeIngestion,
    linkChecker,
    onboardingEmails,
    transferBonusMonitor,
    indiaValuationsScraper,
    valuationRefresh,
    catalogHealthDigest,
    weeklyDigest,
  ],
});
