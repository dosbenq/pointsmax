// ============================================================
// PointsMax — database schema (Drizzle, Postgres on Neon)
//
// Only user data and sign-in live here. Reference data (programs, cards,
// transfer partners, …) ships as JSON in src/data/catalog, so columns that
// point at it (program_id, card_id, transfer_partner_id) are plain UUIDs
// without foreign keys.
//
// To change the schema: edit this file, run `npm run db:generate`, commit
// the new SQL in db/migrations and the regenerated
// src/lib/db/migrations.generated.ts. Migrations are applied by the app
// itself (src/lib/db/migrate.ts).
// ============================================================
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * timestamptz returned as an ISO-8601 string ("2026-01-01T00:00:00.000Z").
 * Postgres' own text form ("2026-01-01 00:00:00+00") is not parsed by Safari,
 * and these values go straight to the browser in API responses.
 */
const isoTimestamp = customType<{ data: string; driverData: string | Date }>({
  dataType: () => 'timestamp with time zone',
  fromDriver: (value) => (value instanceof Date ? value : new Date(value)).toISOString(),
})

const createdAt = () => isoTimestamp('created_at').default(sql`now()`).notNull()

export const subscriptionTier = pgEnum('subscription_tier', ['free', 'premium'])

// ── Sign-in (Better Auth) ──────────────────────────────────────

export const authUser = pgTable('auth_user', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: text().notNull(),
  email: text().notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('auth_user_email_key').on(table.email),
])

export const authSession = pgTable('auth_session', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
}, (table) => [
  unique('auth_session_token_key').on(table.token),
  index('idx_auth_session_user').on(table.userId),
])

export const authAccount = pgTable('auth_account', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull().references(() => authUser.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text(),
  password: text(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_auth_account_user').on(table.userId),
  unique('auth_account_provider_account_key').on(table.providerId, table.accountId),
])

export const authVerification = pgTable('auth_verification', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_auth_verification_identifier').on(table.identifier),
])

// ── App profile and user data ──────────────────────────────────

/** One row per person. Linked to their sign-in through auth_id; emails are stored lowercase. */
export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  email: text().notNull(),
  tier: subscriptionTier().default('free').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: createdAt(),
  authId: uuid('auth_id').references((): AnyPgColumn => authUser.id, { onDelete: 'set null' }),
  lastSeenAt: isoTimestamp('last_seen_at').default(sql`now()`).notNull(),
  // When the Stripe event that last set `tier` happened; older events are ignored.
  tierUpdatedAt: isoTimestamp('tier_updated_at'),
}, (table) => [
  unique('users_email_key').on(table.email),
  unique('users_auth_id_key').on(table.authId),
  index('idx_users_stripe_customer').on(table.stripeCustomerId),
  check('users_email_lowercase', sql`email = lower(email)`),
])

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().notNull().references(() => users.id, { onDelete: 'cascade' }),
  homeAirport: text('home_airport'),
  preferredCabin: text('preferred_cabin').default('any'),
  preferredAirlines: text('preferred_airlines').array().default(sql`'{}'`),
  avoidedAirlines: text('avoided_airlines').array().default(sql`'{}'`),
  digestEmailEnabled: boolean('digest_email_enabled').default(true).notNull(),
  updatedAt: isoTimestamp('updated_at').default(sql`now()`).notNull(),
})

/** Points balances people typed in. program_id is a catalog program id. */
export const userBalances = pgTable('user_balances', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull(),
  balance: bigint({ mode: 'number' }).default(0).notNull(),
  updatedAt: isoTimestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => [
  unique('user_balances_user_id_program_id_key').on(table.userId, table.programId),
])

/** Transfer-bonus email alerts; anyone can subscribe with just an email. */
export const alertSubscriptions = pgTable('alert_subscriptions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  email: text().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  programIds: uuid('program_ids').array().default(sql`'{}'`).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: createdAt(),
}, (table) => [
  unique('alert_subscriptions_email_key').on(table.email),
  index('idx_alert_subscriptions_user_id').on(table.userId),
])

export const flightWatches = pgTable('flight_watches', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  origin: text().notNull(),
  destination: text().notNull(),
  cabin: text().default('business').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  maxPoints: integer('max_points'),
  isActive: boolean('is_active').default(true).notNull(),
  lastCheckedAt: isoTimestamp('last_checked_at'),
  createdAt: createdAt(),
  // Identifies the last deal emailed for this watch so the same deal is not re-sent every run.
  lastAlertKey: text('last_alert_key'),
  lastAlertedAt: isoTimestamp('last_alerted_at'),
}, (table) => [
  index('idx_flight_watches_user_id').on(table.userId),
  index('idx_flight_watches_active').on(table.isActive).where(sql`is_active = true`),
])

/**
 * Time-limited transfer bonuses. Only rows with is_verified = true are shown;
 * the bonus monitor inserts what it detects as unverified.
 */
export const transferBonuses = pgTable('transfer_bonuses', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  transferPartnerId: uuid('transfer_partner_id').notNull(),
  bonusPct: integer('bonus_pct').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  sourceUrl: text('source_url'),
  isVerified: boolean('is_verified').default(false).notNull(),
  notes: text(),
  autoDetected: boolean('auto_detected').default(false).notNull(),
  alertedAt: isoTimestamp('alerted_at'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_bonuses_dates').on(table.startDate, table.endDate),
  index('idx_bonuses_partner').on(table.transferPartnerId),
  check('bonus_dates_valid', sql`end_date >= start_date`),
  check('bonus_pct_positive', sql`bonus_pct > 0`),
])

export const affiliateClicks = pgTable('affiliate_clicks', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  cardId: uuid('card_id'),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  sourcePage: text('source_page'),
  rank: integer(),
  region: text(),
  recommendationMode: text('recommendation_mode'),
  programId: uuid('program_id'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_affiliate_clicks_created_at').on(table.createdAt.desc()),
])

export const sharedTrips = pgTable('shared_trips', {
  id: text().primaryKey().notNull(),
  region: text().notNull(),
  tripData: jsonb('trip_data').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
})

export const subscriptionEvents = pgTable('subscription_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  stripeCustomerId: text('stripe_customer_id'),
  eventType: text('event_type').notNull(),
  previousTier: text('previous_tier'),
  newTier: text('new_tier'),
  occurredAt: isoTimestamp('occurred_at').default(sql`now()`).notNull(),
  metadata: jsonb(),
}, (table) => [
  index('idx_subscription_events_user_id').on(table.userId),
])

/** Stripe event ids already handled, so a re-delivered webhook is processed once. */
export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  stripeEventId: text('stripe_event_id').primaryKey().notNull(),
  eventType: text('event_type').notNull(),
  processedAt: isoTimestamp('processed_at').default(sql`now()`).notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
})

export const cashFareCache = pgTable('cash_fare_cache', {
  id: text().primaryKey().notNull(),
  origin: text().notNull(),
  destination: text().notNull(),
  cabin: text().notNull(),
  travelDate: text('travel_date').notNull(),
  fareUsd: integer('fare_usd').notNull(),
  fetchedAt: isoTimestamp('fetched_at').default(sql`now()`).notNull(),
})

// ── Operations ─────────────────────────────────────────────────

/** One row per completed one-off data import (the November 2026 move to Neon). */
export const dataImports = pgTable('data_imports', {
  id: text().primaryKey().notNull(),
  completedAt: isoTimestamp('completed_at').default(sql`now()`).notNull(),
  counts: jsonb().notNull(),
})
