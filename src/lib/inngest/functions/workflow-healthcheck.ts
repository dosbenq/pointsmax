import { inngest } from '../client'

type WorkflowHealthcheckEventData = {
  run_id?: string
  triggered_by?: string
  triggered_at?: string
  environment?: string
}

/**
 * Workflow healthcheck event.
 * This gives admins a one-click end-to-end event path test:
 * admin UI -> API route -> Inngest event send -> Inngest function execution.
 */
export const workflowHealthcheck = inngest.createFunction(
  { id: 'workflow-healthcheck', name: 'Agent: Workflow Healthcheck' },
  { event: 'workflow.healthcheck' },
  async ({ event, step }) => {
    const payload = (event.data ?? {}) as WorkflowHealthcheckEventData
    const processedAt = await step.run('record-healthcheck', async () => {
      return new Date().toISOString()
    })

    return {
      ok: true,
      run_id: payload.run_id ?? null,
      triggered_by: payload.triggered_by ?? 'unknown',
      triggered_at: payload.triggered_at ?? null,
      environment: payload.environment ?? null,
      processed_at: processedAt,
    }
  },
)
