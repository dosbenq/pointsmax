import { Inngest, InngestMiddleware } from "inngest";
import { logInfo, logError } from "../logger";
import { recordQueueLatency, incrementErrorCount } from "../telemetry";
import { recordDlqEntry } from "../queue-durability";

const monitoringMiddleware = new InngestMiddleware({
  name: "Monitoring Middleware",
  init() {
    return {
      onFunctionRun({ fn, ctx }) {
        const startedAt = Date.now();
        const functionId = fn.id();
        const runId = ctx.runId;

        return {
          transformOutput({ result }) {
            const durationMs = Date.now() - startedAt;
            if (result.error) {
              const errorMessage =
                result.error instanceof Error ? result.error.message : String(result.error);
              logError('inngest_function_failed', {
                functionId,
                runId,
                durationMs,
                error: errorMessage,
                success: false
              });
              incrementErrorCount();
              // Record to DLQ so ops can inspect and replay failed runs
              recordDlqEntry({
                functionId,
                eventName: functionId,
                errorMessage,
                retryCount: 0, // Inngest retries are opaque here; payload captured for replay
              });
            } else {
              logInfo('inngest_function_complete', {
                functionId,
                runId,
                durationMs,
                success: true
              });
              recordQueueLatency(durationMs);
            }
          },
        };
      },
    };
  },
});

// Create a client to send and receive events
export const inngest = new Inngest({ 
  id: "pointsmax",
  middleware: [monitoringMiddleware]
});
