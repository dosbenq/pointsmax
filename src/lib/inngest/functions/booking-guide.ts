import { inngest } from "../client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiModelCandidatesForApiKey } from "@/lib/gemini-models";

/**
 * The Booking Guide Agent
 * An interactive, long-running workflow that guides a user through a redemption.
 */
export const bookingGuide = inngest.createFunction(
  { id: "booking-guide", name: "Agent: Interactive Booking Guide" },
  { event: "booking.started" },
  async ({ event, step }) => {
    const { redemption_label, user_id } = event.data;

    // 1. Initial Research & Step Generation
    const steps = await step.run("generate-booking-checklist", async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return ["Error: API Key missing"];

      const genAI = new GoogleGenerativeAI(apiKey);
      const modelNames = await getGeminiModelCandidatesForApiKey(apiKey);
      const model = genAI.getGenerativeModel({ model: modelNames[0] });

      const prompt = `
        Generate a 4-step checklist for booking the following redemption: ${redemption_label}.
        Focus on specific websites and transfer timing.
        
        FORMAT:
        Step 1: [Action]
        Step 2: [Action]
        ...
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().split("\n").filter(line => line.trim().startsWith("Step"));
    });

    // 2. Interactive Loop
    // For each step, notify the user and wait for them to confirm completion.
    for (let i = 0; i < steps.length; i++) {
      const currentStep = steps[i];

      // In a real app, you'd send a push notification or update a "Current Step" table here.
      await step.run(`notify-step-${i}`, async () => {
        console.log(`User ${user_id} - Current Step: ${currentStep}`);
      });

      // WAIT for the user to click "Complete" in the UI (triggers 'booking.step_completed')
      // This can pause for hours or days without costing money!
      await step.waitForEvent(`wait-for-step-${i}`, {
        event: "booking.step_completed",
        timeout: "24h",
        match: "data.user_id",
      });
    }

    return { message: "Booking complete! Enjoy your trip." };
  }
);
