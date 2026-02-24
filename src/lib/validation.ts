/**
 * Centralized validation schemas using Zod
 * Ensures type safety and consistent validation across API routes
 */

import { z } from 'zod'

// ============================================================================
// Common Validators
// ============================================================================

export const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Must be a valid UUID'
)

export const iataCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Must be a valid 3-letter IATA code')

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')

export const positiveIntSchema = z.number().int().positive()

export const nonEmptyStringSchema = z.string().min(1, 'Cannot be empty')

// ============================================================================
// API Input Schemas
// ============================================================================

// Balance input for calculator
export const balanceInputSchema = z.object({
  program_id: uuidSchema,
  amount: z.number().int().positive('Amount must be positive'),
})

export const calculateRequestSchema = z.object({
  balances: z.array(balanceInputSchema).min(1, 'At least one balance required'),
})

// Award search parameters
export const cabinClassSchema = z.enum(['economy', 'premium_economy', 'business', 'first'])

export const awardSearchRequestSchema = z.object({
  origin: iataCodeSchema,
  destination: iataCodeSchema,
  start_date: dateStringSchema,
  end_date: dateStringSchema,
  cabin: cabinClassSchema,
  passengers: z.number().int().min(1).max(9),
  balances: z.array(balanceInputSchema).min(1),
})

// AI Recommend request
export const aiRecommendRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  balances: z.array(z.object({
    name: z.string().min(1),
    amount: z.number().nonnegative(),
  })).min(1),
  topResults: z.array(z.object({
    label: z.string(),
    total_value_cents: z.number(),
    cpp_cents: z.number(),
    category: z.string().optional(),
    from_program: z.object({ name: z.string() }).optional(),
    to_program: z.object({ name: z.string() }).optional().nullable(),
    active_bonus_pct: z.number().optional(),
  })).optional(),
  history: z.array(z.any()).max(24).optional(),
  preferences: z.object({
    home_airport: z.string().optional().nullable(),
    preferred_cabin: z.string().optional(),
    preferred_airlines: z.array(z.string()).optional(),
    avoided_airlines: z.array(z.string()).optional(),
  }).optional().nullable(),
  region: z.enum(['us', 'in']).optional(),
})

// Affiliate click tracking
export const affiliateClickRequestSchema = z.object({
  card_id: uuidSchema,
  source_page: z.string().max(80).optional(),
})

// User balances
export const userBalancesRequestSchema = z.object({
  balances: z.array(z.object({
    program_id: uuidSchema,
    balance: z.number().int().nonnegative(),
  })).min(1),
})

// User preferences
export const userPreferencesRequestSchema = z.object({
  home_airport: z.string().max(10).nullable().optional(),
  preferred_cabin: z.enum(['economy', 'premium_economy', 'business', 'first', 'any']).optional(),
  preferred_airlines: z.array(z.string()).optional(),
  avoided_airlines: z.array(z.string()).optional(),
})

// Trip builder
export const tripBuilderRequestSchema = z.object({
  destination: z.string().min(1).max(100),
  dates: z.string().min(1).max(100),
  travelers: z.number().int().min(1).max(20),
  budget: z.enum(['budget', 'moderate', 'luxury']),
  pointsBudget: z.enum(['low', 'medium', 'high']).optional(),
  balances: z.array(z.object({
    program: z.string(),
    points: z.number().nonnegative(),
  })).optional(),
})

// ============================================================================
// Validation Helpers
// ============================================================================

export type ValidationError = {
  field: string
  message: string
}

export function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map((err: z.ZodIssue) => ({
    field: err.path.join('.'),
    message: err.message,
  }))
}

export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: formatZodErrors(result.error) }
}

/**
 * Validates date range - end_date must be after start_date
 */
export function validateDateRange(startDate: string, endDate: string): string | null {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (isNaN(start.getTime())) return 'Invalid start_date'
  if (isNaN(end.getTime())) return 'Invalid end_date'
  if (end <= start) return 'end_date must be after start_date'
  
  // Check if dates are not too far in the past
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  if (start < oneYearAgo) return 'start_date cannot be more than 1 year in the past'
  
  // Check if dates are not too far in the future
  const oneYearFuture = new Date()
  oneYearFuture.setFullYear(oneYearFuture.getFullYear() + 1)
  if (end > oneYearFuture) return 'end_date cannot be more than 1 year in the future'
  
  return null
}

/**
 * Validates IATA code format (basic check, not against actual airport database)
 */
export function validateIataCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code)
}
