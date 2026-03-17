import { GoogleGenerativeAI } from '@google/generative-ai'
import { inngest } from '../client'
import { createAdminClient } from '@/lib/supabase'
import { getGeminiModelCandidatesForApiKey } from '@/lib/gemini-models'
import { logError, logInfo, logWarn } from '@/lib/logger'
import {
  buildBookingGuidePrompt,
  type BookingGuideContext,
} from '@/lib/booking-guide-context'
import {
  buildFallbackBookingSteps,
  parseBookingChecklist,
  type BookingGuideSessionRow,
} from '@/lib/booking-guide-store'

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
    const db = createAdminClient()

    const { data: sessionData } = await db
      .from('booking_guide_sessions')
      .select('id, user_id, redemption_label, status, current_step_index, total_steps, started_at, completed_at, last_error, created_at, updated_at')
      .eq('id', session_id)
      .maybeSingle()

    if (!sessionData) {
      logWarn('booking_guide_session_missing', { session_id, user_id })
      return { message: 'Session not found' }
    }

    const session = sessionData as unknown as BookingGuideSessionRow

    try {
      await step.run('mark-session-generating', async () => {
        await db
          .from('booking_guide_sessions')
          .update({
            status: 'generating',
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)
      })

      const stepTitles = await step.run('generate-booking-checklist', async () => {
        return generateChecklist(redemption_label, booking_context ?? null)
      })

      const createdAt = new Date().toISOString()
      const stepRows = stepTitles.map((title, index) => ({
        session_id: session.id,
        step_index: index,
        title,
        status: index === 0 ? 'current' : 'pending',
        completion_note: null,
        completed_at: null,
        created_at: createdAt,
        updated_at: createdAt,
      }))

      await step.run('persist-booking-steps', async () => {
        await db.from('booking_guide_steps').delete().eq('session_id', session.id)
        if (stepRows.length > 0) {
          await db.from('booking_guide_steps').insert(stepRows)
        }
        await db
          .from('booking_guide_sessions')
          .update({
            status: 'active',
            current_step_index: 0,
            total_steps: stepRows.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id)
      })

      for (let index = 0; index < stepRows.length; index += 1) {
        const currentStep = stepRows[index]

        await step.run(`activate-step-${index}`, async () => {
          await db
            .from('booking_guide_sessions')
            .update({
              status: 'active',
              current_step_index: index,
              updated_at: new Date().toISOString(),
            })
            .eq('id', session.id)

          await db
            .from('booking_guide_steps')
            .update({
              status: 'current',
              updated_at: new Date().toISOString(),
            })
            .eq('session_id', session.id)
            .eq('step_index', index)
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
            await db
              .from('booking_guide_steps')
              .update({
                status: 'timed_out',
                updated_at: now,
              })
              .eq('session_id', session.id)
              .eq('step_index', index)

            await db
              .from('booking_guide_sessions')
              .update({
                status: 'timed_out',
                last_error: 'Timed out waiting for user step completion',
                updated_at: now,
              })
              .eq('id', session.id)
          })

          return { message: 'Booking guide timed out waiting for user input.' }
        }

        await step.run(`complete-step-${index}`, async () => {
          const now = new Date().toISOString()
          await db
            .from('booking_guide_steps')
            .update({
              status: 'completed',
              completion_note: getCompletionNote(completionEvent as BookingCompletedEvent),
              completed_at: now,
              updated_at: now,
            })
            .eq('session_id', session.id)
            .eq('step_index', index)

          if (index + 1 < stepRows.length) {
            await db
              .from('booking_guide_steps')
              .update({
                status: 'current',
                updated_at: now,
              })
              .eq('session_id', session.id)
              .eq('step_index', index + 1)
          } else {
            await db
              .from('booking_guide_sessions')
              .update({
                status: 'completed',
                current_step_index: index,
                completed_at: now,
                updated_at: now,
              })
              .eq('id', session.id)
          }
        })
      }

      return { message: 'Booking complete! Enjoy your trip.' }
    } catch (error) {
      await db
        .from('booking_guide_sessions')
        .update({
          status: 'failed',
          last_error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id)

      logError('booking_guide_failed', {
        session_id: session.id,
        user_id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
)
