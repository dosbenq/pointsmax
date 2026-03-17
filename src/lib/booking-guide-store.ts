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

export function buildFallbackBookingSteps(redemptionLabel: string): string[] {
  const label = redemptionLabel.trim() || 'your redemption'
  return [
    `Confirm award space is still available for ${label}`,
    `Transfer only the points needed for ${label}`,
    `Complete the booking on the airline or hotel portal`,
    `Save confirmation details and verify the itinerary`,
  ]
}

export function parseBookingChecklist(raw: string, redemptionLabel: string): string[] {
  const parsed = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*]\s*/, ''))
    .map((line) => line.replace(/^Step\s*\d+\s*:\s*/i, ''))
    .filter(Boolean)

  const unique = [...new Set(parsed)].slice(0, 8)
  return unique.length > 0 ? unique : buildFallbackBookingSteps(redemptionLabel)
}

export function getCurrentBookingGuideStep(
  session: BookingGuideSessionRow | null,
  steps: BookingGuideStepRow[],
): BookingGuideStepRow | null {
  if (!session) return null
  return steps.find((step) => step.step_index === session.current_step_index) ?? null
}
