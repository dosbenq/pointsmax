/**
 * Dead Code Detection Configuration
 * Marks code that should be periodically reviewed for removal
 */

/**
 * @deprecated Marked for removal - use validateRequest from validation.ts instead
 */
export const DEPRECATED_VALIDATION_PATTERNS = [
  'manual JSON.parse without schema validation',
  'typeof checks for API inputs',
  'inline validation in route handlers',
] as const

/**
 * Code sections that should be reviewed periodically
 */
export const CODE_REVIEW_QUEUE = {
  // Backward compatibility code that can be removed after migrations
  backwardCompatibility: [
    {
      file: 'src/app/api/programs/route.ts',
      description: 'geography column fallback for old schema',
      removeAfter: '2026-03-01',
      condition: 'When all environments have geography column',
    },
    {
      file: 'src/app/api/cards/route.ts',
      description: 'geography column fallback for old schema',
      removeAfter: '2026-03-01',
      condition: 'When all environments have geography column',
    },
    {
      file: 'src/lib/cpp-fallback.ts',
      description: 'Legacy India CPP normalization (rupees to paise)',
      removeAfter: '2026-03-07',
      condition: 'Resolved by migration 033_normalize_india_cpp_units.sql',
    },
  ],

  // Feature flags that should be removed when features are stable
  featureFlags: [
    {
      name: 'GEMINI_SAFE_MODE',
      description: 'Force Gemini into safe mode',
      defaultValue: false,
      stableSince: '2026-01-15',
    },
  ],

  // Console statements that should use logger
  consoleReplacements: [
    {
      pattern: /console\.(log|warn|error|info)\s*\(/g,
      replacement: 'Use logInfo, logWarn, or logError from logger.ts',
      severity: 'warning',
    },
  ],

  // Hardcoded values that should be in config
  hardcodedValues: [
    {
      pattern: /https:\/\/[^\s"']+/g,
      description: 'Hardcoded URLs - should be in booking-urls.ts or config',
      files: ['src/app/api/**/*.ts'],
    },
  ],
} as const

/**
 * Checks if a piece of code is scheduled for removal
 */
export function isScheduledForRemoval(reviewDate: string): boolean {
  return new Date() > new Date(reviewDate)
}

type BackwardCompatItem = typeof CODE_REVIEW_QUEUE.backwardCompatibility[number]

/**
 * Log code review items that are due
 */
export function getOverdueReviews(): BackwardCompatItem[] {
  return CODE_REVIEW_QUEUE.backwardCompatibility.filter(
    item => isScheduledForRemoval(item.removeAfter)
  )
}
