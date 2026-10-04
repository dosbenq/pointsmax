import { GoogleGenerativeAI } from '@google/generative-ai'
import { inngest } from '../client'
import { and, eq } from 'drizzle-orm'
import { getDb, type Database } from '@/lib/db/client'
import { bookingGuideSessions, bookingGuideSteps } from '@/lib/db/schema'
import { getGeminiModelCandidatesForApiKey } from '@/lib/gemini-models'
import { logError, logInfo, logWarn } from '@/lib/logger'
import {
  buildBookingGuidePrompt,
  type BookingGuideContext,
} from '@/lib/booking-guide-context'
import {
  buildFallbackBookingSteps,
  parseBookingChecklist,
} from '@/lib/booking-guide-store'

type SessionPatch = Partial<typeof bookingGuideSessions.$inferInsert>
type StepPatch = Partial<typeof bookingGuideSteps.$inferInsert>

async function updateSession(db: Database, sessionId: string, patch: SessionPatch) {
  await db
    .update(bookingGuideSessions)
    .set({ ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() })
    .where(eq(bookingGuideSessions.id, sessionId))
}

async function updateStep(db: Database, sessionId: string, stepIndex: number, patch: StepPatch) {
  await db
    .update(bookingGuideSteps)
    .set({ ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() })
    .where(and(eq(bookingGuideSteps.sessionId, sessionId), eq(bookingGuideSteps.stepIndex, stepIndex)))
}

type BookingStartedEvent = {
  data: {
    session_id: string
    user_id: string
    redemption_label: string
    booking_context?: BookingGuideContext | null
  }
}

type BookingCompletedEvent = {
  data?: {
    note?: unknown
  }
} | null

function getCompletionNote(event: BookingCompletedEvent): string | null {
  const note = event?.data?.note
  return typeof note === 'string' && note.trim() ? note.trim() : null
}

async function generateChecklist(
  redemptionLabel: string,
  bookingContext: BookingGuideContext | null,
): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return buildFallbackBookingSteps(redemptionLabel, bookingContext)
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const modelNames = await getGeminiModelCandidatesForApiKey(apiKey)
    const model = genAI.getGenerativeModel({ model: modelNames[0] })
    const prompt = buildBookingGuidePrompt(redemptionLabel, bookingContext)

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    return parseBookingChecklist(text, redemptionLabel, bookingContext)
  } catch (error) {
    logWarn('booking_guide_generate_checklist_fallback', {
      redemption_label: redemptionLabel,
      error: error instanceof Error ? error.message : String(error),
    })
    return buildFallbackBookingSteps(redemptionLabel, bookingContext)
  }
}

export const bookingGuide = inngest.createFunction(
  { id: 'booking-guide', name: 'Agent: Interactive Booking Guide' },
  { event: 'booking.started' },
  async ({ event, step }) => {
    const {
      session_id,
      user_id,
      redemption_label,
      booking_context,
    } = (event as BookingStartedEvent).data
    const db = getDb()

    const [session] = await db
      .select({ id: bookingGuideSessions.id })
      .from(bookingGuideSessions)
      .where(eq(bookingGuideSessions.id, session_id))
      .limit(1)

    if (!session) {
      logWarn('booking_guide_session_missing', { session_id, user_id })
      return { message: 'Session not found' }
    }

    try {
      await step.run('mark-session-generating', async () => {
        await updateSession(db, session.id, { status: 'generating', lastError: null })
      })

      const stepTitles = await step.run('generate-booking-checklist', async () => {
        return generateChecklist(redemption_label, booking_context ?? null)
      })

      const createdAt = new Date().toISOString()
      const stepRows = stepTitles.map((title, index) => ({
        sessionId: session.id,
        stepIndex: index,
        title,
        status: index === 0 ? 'current' : 'pending',
        createdAt,
        updatedAt: createdAt,
      }))

      await step.run('persist-booking-steps', async () => {
        await db.transaction(async (tx) => {
          await tx.delete(bookingGuideSteps).where(eq(bookingGuideSteps.sessionId, session.id))
          if (stepRows.length > 0) {
            await tx.insert(bookingGuideSteps).values(stepRows)
          }
          await updateSession(tx, session.id, {
            status: 'active',
            currentStepIndex: 0,
            totalSteps: stepRows.length,
          })
        })
      })

      for (let index = 0; index < stepRows.length; index += 1) {
        const currentStep = stepRows[index]

        await step.run(`activate-step-${index}`, async () => {
          await updateSession(db, session.id, { status: 'active', currentStepIndex: index })
          await updateStep(db, session.id, index, { status: 'current' })
        })

        logInfo('booking_guide_step_ready', {
          session_id: session.id,
          user_id,
          step_index: index,
          title: currentStep.title,
        })

        const completionEvent = await step.waitForEvent(`wait-for-step-${index}`, {
          event: 'booking.step_completed',
          timeout: '24h',
          match: 'data.session_id',
        })

        if (!completionEvent) {
          await step.run(`timeout-step-${index}`, async () => {
            const now = new Date().toISOString()
            await updateStep(db, session.id, index, { status: 'timed_out', updatedAt: now })
            await updateSession(db, session.id, {
              status: 'timed_out',
              lastError: 'Timed out waiting for user step completion',
              updatedAt: now,
            })
          })

          return { message: 'Booking guide timed out waiting for user input.' }
        }

        await step.run(`complete-step-${index}`, async () => {
          const now = new Date().toISOString()
          await updateStep(db, session.id, index, {
            status: 'completed',
            completionNote: getCompletionNote(completionEvent as BookingCompletedEvent),
            completedAt: now,
            updatedAt: now,
          })

          if (index + 1 < stepRows.length) {
            await updateStep(db, session.id, index + 1, { status: 'current', updatedAt: now })
          } else {
            await updateSession(db, session.id, {
              status: 'completed',
              currentStepIndex: index,
              completedAt: now,
              updatedAt: now,
            })
          }
        })
      }

      return { message: 'Booking complete! Enjoy your trip.' }
    } catch (error) {
      await updateSession(db, session.id, {
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      })

      logError('booking_guide_failed', {
        session_id: session.id,
        user_id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
)
