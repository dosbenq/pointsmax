import type { BookingGuideContext } from '@/lib/booking-guide-context'

export type BookingGuideSessionStatus =
  | 'pending'
  | 'generating'
  | 'active'
  | 'completed'
  | 'timed_out'
  | 'failed'
  | 'cancelled'

export type BookingGuideStepStatus =
  | 'pending'
  | 'current'
  | 'completed'
  | 'timed_out'
  | 'cancelled'

export type BookingGuideSessionRow = {
  id: string
  user_id: string
  redemption_label: string
  status: BookingGuideSessionStatus
  current_step_index: number
  total_steps: number
  started_at: string
  completed_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type BookingGuideStepRow = {
  id: string
  session_id: string
  step_index: number
  title: string
  status: BookingGuideStepStatus
  completion_note: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export function buildFallbackBookingSteps(
  redemptionLabel: string,
  context: BookingGuideContext | null = null,
): string[] {
  const label = redemptionLabel.trim() || 'your redemption'
  const availabilityDetail = context?.availability_date
    ? ` on ${context.availability_date}`
    : ''
  const transferDetail = context?.transfer_chain
    ? ` using ${context.transfer_chain}`
    : ` for ${label}`
  const bookingPortal = context?.deep_link_label ?? context?.program_name ?? 'the airline or hotel portal'

  return [
    `Confirm award space is still available for ${label}${availabilityDetail}`,
    `Transfer only the points needed${transferDetail}`,
    `Complete the booking on ${bookingPortal}`,
    `Save confirmation details and verify the itinerary`,
  ]
}

export function parseBookingChecklist(
  raw: string,
  redemptionLabel: string,
  context: BookingGuideContext | null = null,
): string[] {
  const parsed = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .map((line) => line.replace(/^Step\s*\d+\s*:\s*/i, ''))
    .filter(Boolean)

  const unique = [...new Set(parsed)].slice(0, 8)
  return unique.length > 0 ? unique : buildFallbackBookingSteps(redemptionLabel, context)
}

export function getCurrentBookingGuideStep(
  session: BookingGuideSessionRow | null,
  steps: BookingGuideStepRow[],
): BookingGuideStepRow | null {
  if (!session) return null
  return steps.find((step) => step.step_index === session.current_step_index) ?? null
}
