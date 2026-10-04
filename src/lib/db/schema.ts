// ============================================================
// PointsMax — database schema (Drizzle)
// Introspected from the replayed Supabase migrations, then cleaned:
// RLS policies removed (only the server talks to the database), the
// users.auth_id FK to Supabase's auth.users dropped (auth now lives in
// the Better Auth tables), and active_bonuses restricted to verified,
// active bonuses (see supabase/migrations/064).
// ============================================================
import { type AnyPgColumn, pgTable, index, unique, uuid, text, boolean, integer, timestamp, jsonb, uniqueIndex, foreignKey, numeric, date, check, bigint, vector, pgView, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const programType = pgEnum("program_type", ['transferable_points', 'airline_miles', 'hotel_points', 'cashback'])
export const redemptionCategory = pgEnum("redemption_category", ['transfer_partner', 'travel_portal', 'statement_credit', 'cashback', 'gift_cards', 'pay_with_points'])
export const spendCategory = pgEnum("spend_category", ['dining', 'groceries', 'travel', 'gas', 'streaming', 'other', 'shopping'])
export const subscriptionTier = pgEnum("subscription_tier", ['free', 'premium'])
export const valuationSource = pgEnum("valuation_source", ['tpg', 'nerdwallet', 'manual', 'cardexpert', 'technofino'])


export const programs = pgTable("programs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	shortName: text("short_name").notNull(),
	slug: text().notNull(),
	type: programType().notNull(),
	issuer: text(),
	logoUrl: text("logo_url"),
	colorHex: text("color_hex").default('#6366f1'),
	isActive: boolean("is_active").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	geography: text().default('global').notNull(),
	bestUses: text("best_uses").array().default(sql`'{}'`).notNull(),
	transferPartners: jsonb("transfer_partners"),
	bestRedemption: text("best_redemption"),
	worstRedemption: text("worst_redemption"),
}, (table) => [
	index("idx_programs_active").on(table.isActive),
	index("idx_programs_geography").on(table.geography),
	index("idx_programs_slug").on(table.slug),
	index("idx_programs_type").on(table.type),
	unique("programs_slug_key").on(table.slug),
]);

export const valuations = pgTable("valuations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	programId: uuid("program_id").notNull(),
	cppCents: numeric("cpp_cents", { precision: 10, scale:  4 }).notNull(),
	source: valuationSource().default('manual').notNull(),
	sourceUrl: text("source_url"),
	effectiveDate: date("effective_date").default(sql`CURRENT_DATE`).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_valuations_date").on(table.effectiveDate.desc()),
	index("idx_valuations_program").on(table.programId),
	uniqueIndex("idx_valuations_program_date_source").on(table.programId, table.effectiveDate, table.source),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [programs.id],
			name: "valuations_program_id_fkey"
		}).onDelete("cascade"),
]);

export const transferPartners = pgTable("transfer_partners", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	fromProgramId: uuid("from_program_id").notNull(),
	toProgramId: uuid("to_program_id").notNull(),
	ratioFrom: integer("ratio_from").default(1).notNull(),
	ratioTo: integer("ratio_to").default(1).notNull(),
	minTransfer: integer("min_transfer").default(1000).notNull(),
	transferIncrement: integer("transfer_increment").default(1000).notNull(),
	transferTimeMinHrs: integer("transfer_time_min_hrs").default(0).notNull(),
	transferTimeMaxHrs: integer("transfer_time_max_hrs").default(72).notNull(),
	isInstant: boolean("is_instant").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_tp_from").on(table.fromProgramId),
	index("idx_tp_to").on(table.toProgramId),
	foreignKey({
			columns: [table.fromProgramId],
			foreignColumns: [programs.id],
			name: "transfer_partners_from_program_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.toProgramId],
			foreignColumns: [programs.id],
			name: "transfer_partners_to_program_id_fkey"
		}).onDelete("cascade"),
	unique("transfer_partners_from_program_id_to_program_id_key").on(table.fromProgramId, table.toProgramId),
]);

export const transferBonuses = pgTable("transfer_bonuses", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	transferPartnerId: uuid("transfer_partner_id").notNull(),
	bonusPct: integer("bonus_pct").notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	sourceUrl: text("source_url"),
	isVerified: boolean("is_verified").default(false).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	alertedAt: timestamp("alerted_at", { withTimezone: true, mode: 'string' }),
	autoDetected: boolean("auto_detected").default(false).notNull(),
	verified: boolean().default(false).notNull(),
	active: boolean().default(true).notNull(),
}, (table) => [
	index("idx_bonuses_alerted").on(table.alertedAt).where(sql`(alerted_at IS NULL)`),
	index("idx_bonuses_dates").on(table.startDate, table.endDate),
	index("idx_bonuses_partner").on(table.transferPartnerId),
	foreignKey({
			columns: [table.transferPartnerId],
			foreignColumns: [transferPartners.id],
			name: "transfer_bonuses_transfer_partner_id_fkey"
		}).onDelete("cascade"),
	check("bonus_dates_valid", sql`end_date >= start_date`),
	check("bonus_pct_positive", sql`bonus_pct > 0`),
]);

export const redemptionOptions = pgTable("redemption_options", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	programId: uuid("program_id").notNull(),
	category: redemptionCategory().notNull(),
	cppCents: numeric("cpp_cents", { precision: 10, scale:  4 }).notNull(),
	label: text().notNull(),
	notes: text(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_redemption_program").on(table.programId),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [programs.id],
			name: "redemption_options_program_id_fkey"
		}).onDelete("cascade"),
]);

export const userBalances = pgTable("user_balances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	programId: uuid("program_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	balance: bigint({ mode: "number" }).default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_balances_program").on(table.programId),
	index("idx_balances_user").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_balances_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [programs.id],
			name: "user_balances_program_id_fkey"
		}).onDelete("cascade"),
	unique("user_balances_user_id_program_id_key").on(table.userId, table.programId),
]);

export const alertSubscriptions = pgTable("alert_subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	userId: uuid("user_id"),
	programIds: uuid("program_ids").array().default(sql`'{}'`).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_alert_active").on(table.isActive),
	index("idx_alert_email").on(table.email),
	index("idx_alert_subscriptions_user_id").on(table.userId).where(sql`(user_id IS NOT NULL)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "alert_subscriptions_user_id_fkey"
		}).onDelete("set null"),
	unique("alert_subscriptions_email_key").on(table.email),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	tier: subscriptionTier().default('free').notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	authId: uuid("auth_id").references((): AnyPgColumn => authUser.id, { onDelete: "cascade" }),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_users_last_seen_at").on(table.lastSeenAt.desc()),
	unique("users_email_key").on(table.email),
	unique("users_auth_id_key").on(table.authId),
]);

export const userPreferences = pgTable("user_preferences", {
	userId: uuid("user_id").primaryKey().notNull(),
	homeAirport: text("home_airport"),
	preferredCabin: text("preferred_cabin").default('any'),
	preferredAirlines: text("preferred_airlines").array().default(sql`'{}'`),
	avoidedAirlines: text("avoided_airlines").array().default(sql`'{}'`),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	digestEmailEnabled: boolean("digest_email_enabled").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_preferences_user_id_fkey"
		}).onDelete("cascade"),
]);

export const cardEarningRates = pgTable("card_earning_rates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	cardId: uuid("card_id").notNull(),
	category: spendCategory().notNull(),
	earnMultiplier: numeric("earn_multiplier", { precision: 6, scale:  2 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.cardId],
			foreignColumns: [cards.id],
			name: "card_earning_rates_card_id_fkey"
		}).onDelete("cascade"),
	unique("card_earning_rates_card_id_category_key").on(table.cardId, table.category),
]);

export const affiliateClicks = pgTable("affiliate_clicks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	cardId: uuid("card_id"),
	userId: uuid("user_id"),
	sourcePage: text("source_page"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	creatorSlug: text("creator_slug"),
	rank: integer(),
	region: text(),
}, (table) => [
	index("idx_affiliate_clicks_card_source").on(table.cardId, table.sourcePage),
	index("idx_affiliate_clicks_created_at").on(table.createdAt.desc()),
	index("idx_affiliate_clicks_creator_slug").on(table.creatorSlug, table.createdAt.desc()),
	index("idx_affiliate_clicks_region").on(table.region),
	foreignKey({
			columns: [table.cardId],
			foreignColumns: [cards.id],
			name: "affiliate_clicks_card_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "affiliate_clicks_user_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.creatorSlug],
			foreignColumns: [creators.slug],
			name: "affiliate_clicks_creator_slug_fkey"
		}).onDelete("set null"),
]);

export const flightWatches = pgTable("flight_watches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	origin: text().notNull(),
	destination: text().notNull(),
	cabin: text().default('business').notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	maxPoints: integer("max_points"),
	isActive: boolean("is_active").default(true).notNull(),
	lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_flight_watches_active").on(table.isActive).where(sql`(is_active = true)`),
	index("idx_flight_watches_user_id").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "flight_watches_user_id_fkey"
		}).onDelete("cascade"),
]);

export const knowledgeDocs = pgTable("knowledge_docs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sourceId: text("source_id").notNull(),
	sourceUrl: text("source_url").notNull(),
	title: text().notNull(),
	content: text().notNull(),
	embedding: vector({ dimensions: 768 }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	contentHash: text("content_hash").notNull(),
}, (table) => [
	uniqueIndex("idx_knowledge_docs_source_hash").on(table.sourceId, table.contentHash),
	index("knowledge_docs_embedding_idx").using("ivfflat", table.embedding.op("vector_cosine_ops")).with({ lists: 100 }),
]);

export const linkHealthLog = pgTable("link_health_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	runId: text("run_id").notNull(),
	cardId: uuid("card_id"),
	url: text().notNull(),
	statusCode: integer("status_code"),
	ok: boolean().notNull(),
	checkedAt: timestamp("checked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_link_health_log_checked_at").on(table.checkedAt.desc()),
	index("idx_link_health_log_ok").on(table.ok, table.checkedAt.desc()),
	index("idx_link_health_log_run_id").on(table.runId),
	foreignKey({
			columns: [table.cardId],
			foreignColumns: [cards.id],
			name: "link_health_log_card_id_fkey"
		}).onDelete("set null"),
]);

export const sharedTrips = pgTable("shared_trips", {
	id: text().primaryKey().notNull(),
	region: text().notNull(),
	tripData: jsonb("trip_data").notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_shared_trips_created_at").on(table.createdAt.desc()),
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "shared_trips_created_by_fkey"
		}).onDelete("set null"),
]);

export const adminAuditLog = pgTable("admin_audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	adminEmail: text("admin_email").notNull(),
	action: text().notNull(),
	targetId: text("target_id"),
	payload: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_admin_audit_log_action").on(table.action),
	index("idx_admin_audit_log_created_at").on(table.createdAt.desc()),
]);

export const bookingUrls = pgTable("booking_urls", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	programSlug: text("program_slug").notNull(),
	label: text().notNull(),
	url: text().notNull(),
	region: text().notNull(),
	sortOrder: integer("sort_order").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	check("booking_urls_region_check", sql`region = ANY (ARRAY['us'::text, 'in'::text, 'global'::text])`),
]);

export const deadLetterQueue = pgTable("dead_letter_queue", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	functionId: text("function_id").notNull(),
	eventName: text("event_name").notNull(),
	payload: jsonb(),
	errorMessage: text("error_message").default('').notNull(),
	retryCount: integer("retry_count").default(0).notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastAttemptedAt: timestamp("last_attempted_at", { withTimezone: true, mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	resolvedBy: text("resolved_by"),
}, (table) => [
	index("idx_dlq_function_id").on(table.functionId, table.createdAt.desc()),
	index("idx_dlq_status_created").on(table.status, table.createdAt.desc()).where(sql`(status = ANY (ARRAY['pending'::text, 'retrying'::text]))`),
	check("dead_letter_queue_status_check", sql`status = ANY (ARRAY['pending'::text, 'retrying'::text, 'resolved'::text])`),
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
	key: text().primaryKey().notNull(),
	status: text().default('pending').notNull(),
	responseData: jsonb("response_data"),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).default(sql`(now() + '24:00:00'::interval)`).notNull(),
}, (table) => [
	index("idx_idempotency_keys_expires").on(table.expiresAt),
	index("idx_idempotency_keys_key_status_expires").on(table.key, table.status, table.expiresAt),
	check("idempotency_keys_status_check", sql`status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text])`),
]);

export const connectedAccounts = pgTable("connected_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	provider: text().notNull(),
	displayName: text("display_name"),
	tokenVaultRef: text("token_vault_ref").notNull(),
	status: text().default('active').notNull(),
	tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: 'string' }),
	scopes: text(),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	syncStatus: text("sync_status").default('pending').notNull(),
	errorCode: text("error_code"),
}, (table) => [
	index("idx_connected_accounts_active_sync").on(table.lastSyncedAt.asc().nullsFirst()).where(sql`(status = 'active'::text)`),
	index("idx_connected_accounts_provider").on(table.provider, table.status),
	index("idx_connected_accounts_sync_status").on(table.syncStatus, table.lastSyncedAt.asc().nullsFirst()).where(sql`(status = 'active'::text)`),
	index("idx_connected_accounts_user_id").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "connected_accounts_user_id_fkey"
		}).onDelete("cascade"),
	unique("uq_connected_accounts_user_provider_active").on(table.userId, table.provider),
	check("connected_accounts_error_code_check", sql`error_code = ANY (ARRAY['auth_error'::text, 'rate_limit'::text, 'provider_error'::text, 'unknown'::text])`),
	check("connected_accounts_status_check", sql`status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])`),
	check("connected_accounts_sync_status_check", sql`sync_status = ANY (ARRAY['pending'::text, 'syncing'::text, 'ok'::text, 'error'::text, 'stale'::text])`),
]);

export const connectorAuditLog = pgTable("connector_audit_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	accountId: uuid("account_id"),
	provider: text().notNull(),
	eventType: text("event_type").notNull(),
	actor: text().default('user').notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_connector_audit_log_account_time").on(table.accountId, table.createdAt.desc()).where(sql`(account_id IS NOT NULL)`),
	index("idx_connector_audit_log_event_type").on(table.eventType, table.createdAt.desc()),
	index("idx_connector_audit_log_user_time").on(table.userId, table.createdAt.desc()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "connector_audit_log_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [connectedAccounts.id],
			name: "connector_audit_log_account_id_fkey"
		}).onDelete("set null"),
	check("connector_audit_log_actor_check", sql`actor = ANY (ARRAY['user'::text, 'system'::text, 'admin'::text])`),
	check("connector_audit_log_event_type_check", sql`event_type = ANY (ARRAY['connect'::text, 'disconnect'::text, 'sync'::text, 'manual_override'::text, 'delete'::text, 'token_revoke'::text, 'auth_error'::text])`),
]);

export const balanceSnapshots = pgTable("balance_snapshots", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	connectedAccountId: uuid("connected_account_id").notNull(),
	userId: uuid("user_id").notNull(),
	programId: uuid("program_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	balance: bigint({ mode: "number" }).notNull(),
	source: text().default('connector').notNull(),
	providerCursor: text("provider_cursor"),
	rawPayload: jsonb("raw_payload"),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_balance_snapshots_account_time").on(table.connectedAccountId, table.fetchedAt.desc()),
	index("idx_balance_snapshots_user_program_time").on(table.userId, table.programId, table.fetchedAt.desc()),
	foreignKey({
			columns: [table.connectedAccountId],
			foreignColumns: [connectedAccounts.id],
			name: "balance_snapshots_connected_account_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "balance_snapshots_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [programs.id],
			name: "balance_snapshots_program_id_fkey"
		}),
	check("balance_snapshots_balance_check", sql`balance >= 0`),
	check("balance_snapshots_source_check", sql`source = ANY (ARRAY['connector'::text, 'manual'::text])`),
]);

export const bookingGuideSteps = pgTable("booking_guide_steps", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	stepIndex: integer("step_index").notNull(),
	title: text().notNull(),
	status: text().default('pending').notNull(),
	completionNote: text("completion_note"),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_booking_guide_steps_session_step").on(table.sessionId, table.stepIndex),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [bookingGuideSessions.id],
			name: "booking_guide_steps_session_id_fkey"
		}).onDelete("cascade"),
	unique("booking_guide_steps_session_step_unique").on(table.sessionId, table.stepIndex),
	check("booking_guide_steps_status_check", sql`status = ANY (ARRAY['pending'::text, 'current'::text, 'completed'::text, 'timed_out'::text, 'cancelled'::text])`),
	check("booking_guide_steps_step_index_check", sql`step_index >= 0`),
]);

export const bookingGuideSessions = pgTable("booking_guide_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	redemptionLabel: text("redemption_label").notNull(),
	status: text().default('pending').notNull(),
	currentStepIndex: integer("current_step_index").default(0).notNull(),
	totalSteps: integer("total_steps").default(0).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_booking_guide_sessions_user_created").on(table.userId, table.createdAt.desc()),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "booking_guide_sessions_user_id_fkey"
		}).onDelete("cascade"),
	check("booking_guide_sessions_current_step_check", sql`current_step_index >= 0`),
	check("booking_guide_sessions_status_check", sql`status = ANY (ARRAY['pending'::text, 'generating'::text, 'active'::text, 'completed'::text, 'timed_out'::text, 'failed'::text, 'cancelled'::text])`),
	check("booking_guide_sessions_total_steps_check", sql`total_steps >= 0`),
]);

export const catalogCardsStaging = pgTable("catalog_cards_staging", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	region: text().notNull(),
	issuerName: text("issuer_name").notNull(),
	cardName: text("card_name").notNull(),
	cardSlugCandidate: text("card_slug_candidate").notNull(),
	programName: text("program_name").notNull(),
	programSlugCandidate: text("program_slug_candidate").notNull(),
	geography: text().notNull(),
	currency: text().notNull(),
	earnUnit: text("earn_unit").notNull(),
	catalogStatus: text("catalog_status").notNull(),
	sourceConfidence: text("source_confidence").notNull(),
	seedReadiness: text("seed_readiness").notNull(),
	imageAssetSlug: text("image_asset_slug").notNull(),
	sourceUrl: text("source_url").notNull(),
	sourceScope: text("source_scope").notNull(),
	officialImageStrategy: text("official_image_strategy").default('fetch_official_asset_then_self_host').notNull(),
	officialImageStatus: text("official_image_status").default('pending_asset_extraction').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_catalog_cards_staging_region").on(table.region, table.catalogStatus),
	unique("catalog_cards_staging_region_card_slug_candidate_key").on(table.region, table.cardSlugCandidate),
]);

export const programSlugAliases = pgTable("program_slug_aliases", {
	aliasSlug: text("alias_slug").primaryKey().notNull(),
	canonicalSlug: text("canonical_slug").notNull(),
	geography: text().default('global').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_program_slug_aliases_canonical").on(table.canonicalSlug),
]);

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
	stripeEventId: text("stripe_event_id").primaryKey().notNull(),
	eventType: text("event_type").notNull(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	rawPayload: jsonb("raw_payload").notNull(),
}, (table) => [
]);

export const subscriptionEvents = pgTable("subscription_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	stripeCustomerId: text("stripe_customer_id"),
	eventType: text("event_type").notNull(),
	previousTier: text("previous_tier"),
	newTier: text("new_tier"),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
}, (table) => [
	index("idx_subscription_events_customer").on(table.stripeCustomerId),
	index("idx_subscription_events_user_id").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscription_events_user_id_fkey"
		}).onDelete("set null"),
]);

export const inspirationRoutes = pgTable("inspiration_routes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	region: text().notNull(),
	originIata: text("origin_iata"),
	destinationIata: text("destination_iata").notNull(),
	destinationLabel: text("destination_label").notNull(),
	cabin: text().notNull(),
	programSlug: text("program_slug").notNull(),
	milesRequired: integer("miles_required").notNull(),
	estimatedCashValueUsd: integer("estimated_cash_value_usd").notNull(),
	cppCents: numeric("cpp_cents").notNull(),
	headline: text().notNull(),
	description: text().notNull(),
	isFeatured: boolean("is_featured").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("idx_inspiration_routes_unique").on(table.region, table.originIata, table.destinationIata, table.cabin, table.programSlug, table.headline),
	check("inspiration_routes_region_check", sql`region = ANY (ARRAY['US'::text, 'IN'::text, 'GLOBAL'::text])`),
]);

export const cashFareCache = pgTable("cash_fare_cache", {
	id: text().primaryKey().notNull(),
	origin: text().notNull(),
	destination: text().notNull(),
	cabin: text().notNull(),
	travelDate: text("travel_date").notNull(),
	fareUsd: integer("fare_usd").notNull(),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
]);

export const onboardingEmailLog = pgTable("onboarding_email_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	email: text().notNull(),
	emailKind: text("email_kind").notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	metadata: jsonb(),
}, (table) => [
	index("idx_onboarding_email_log_sent_at").on(table.sentAt.desc()),
	uniqueIndex("idx_onboarding_email_log_unique").on(table.userId, table.emailKind),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "onboarding_email_log_user_id_fkey"
		}).onDelete("cascade"),
]);

export const hotelPrograms = pgTable("hotel_programs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	chain: text().notNull(),
	geography: text().default('GLOBAL').notNull(),
	colorHex: text("color_hex"),
	bookingUrl: text("booking_url"),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_hotel_programs_active").on(table.isActive),
	index("idx_hotel_programs_slug").on(table.slug),
	unique("hotel_programs_slug_key").on(table.slug),
]);

export const hotelAwardCharts = pgTable("hotel_award_charts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	programId: uuid("program_id").notNull(),
	destinationRegion: text("destination_region").notNull(),
	tierLabel: text("tier_label").notNull(),
	tierNumber: integer("tier_number").notNull(),
	pointsOffPeak: integer("points_off_peak"),
	pointsStandard: integer("points_standard").notNull(),
	pointsPeak: integer("points_peak"),
	estimatedCashUsd: integer("estimated_cash_usd").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_hotel_award_charts_program_region").on(table.programId, table.destinationRegion, table.tierNumber),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [hotelPrograms.id],
			name: "hotel_award_charts_program_id_fkey"
		}).onDelete("cascade"),
	unique("hotel_award_charts_program_id_destination_region_tier_numbe_key").on(table.programId, table.destinationRegion, table.tierNumber),
	check("hotel_award_charts_destination_region_check", sql`destination_region = ANY (ARRAY['north_america'::text, 'europe'::text, 'middle_east_africa'::text, 'asia_pacific'::text, 'latin_america'::text, 'india'::text])`),
]);

export const creatorConversions = pgTable("creator_conversions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	creatorSlug: text("creator_slug").notNull(),
	userId: uuid("user_id"),
	convertedAt: timestamp("converted_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	plan: text().default('premium').notNull(),
	revenueUsd: integer("revenue_usd").default(999).notNull(),
}, (table) => [
	index("idx_creator_conversions_slug").on(table.creatorSlug, table.convertedAt.desc()),
	index("idx_creator_conversions_user").on(table.userId, table.convertedAt.desc()),
	foreignKey({
			columns: [table.creatorSlug],
			foreignColumns: [creators.slug],
			name: "creator_conversions_creator_slug_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "creator_conversions_user_id_fkey"
		}).onDelete("set null"),
]);

export const creators = pgTable("creators", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	platform: text(),
	profileUrl: text("profile_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("creators_slug_key").on(table.slug),
]);

export const comparisonPages = pgTable("comparison_pages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	slug: text().notNull(),
	region: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	cardSlugs: text("card_slugs").array().notNull(),
	categoryFocus: text("category_focus"),
	isPublished: boolean("is_published").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
}, (table) => [
	index("idx_comparison_pages_region").on(table.region, table.isPublished, table.displayOrder),
	unique("comparison_pages_slug_key").on(table.slug),
	check("comparison_pages_region_check", sql`region = ANY (ARRAY['us'::text, 'in'::text])`),
]);

export const catalogProgramsStaging = pgTable("catalog_programs_staging", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	region: text().notNull(),
	programName: text("program_name").notNull(),
	shortNameCandidate: text("short_name_candidate").notNull(),
	programKind: text("program_kind").notNull(),
	operatorName: text("operator_name").notNull(),
	programSlugCandidate: text("program_slug_candidate").notNull(),
	geography: text().notNull(),
	catalogStatus: text("catalog_status").notNull(),
	sourceConfidence: text("source_confidence").notNull(),
	seedReadiness: text("seed_readiness").notNull(),
	sourceUrl: text("source_url").notNull(),
	sourceScope: text("source_scope").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_catalog_programs_staging_region").on(table.region, table.catalogStatus),
	unique("catalog_programs_staging_region_program_slug_candidate_key").on(table.region, table.programSlugCandidate),
]);

export const programNameAliases = pgTable("program_name_aliases", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	programSlug: text("program_slug").notNull(),
	alias: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_program_name_aliases_slug").on(table.programSlug),
	foreignKey({
			columns: [table.programSlug],
			foreignColumns: [programs.slug],
			name: "program_name_aliases_program_slug_fkey"
		}).onDelete("cascade"),
	unique("program_name_aliases_alias_key").on(table.alias),
]);

export const cards = pgTable("cards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	issuer: text().notNull(),
	annualFeeUsd: integer("annual_fee_usd").default(0).notNull(),
	signupBonusPts: integer("signup_bonus_pts").default(0).notNull(),
	signupBonusSpend: integer("signup_bonus_spend").default(0).notNull(),
	programId: uuid("program_id").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	applyUrl: text("apply_url"),
	currency: text().default('USD').notNull(),
	earnUnit: text("earn_unit").default('1_dollar').notNull(),
	geography: text().default('US').notNull(),
	imageUrl: text("image_url"),
	earningRates: text("earning_rates"),
	topPerks: text("top_perks"),
	communitySentiment: text("community_sentiment"),
	idealFor: text("ideal_for"),
	recentChanges: text("recent_changes"),
	expertSummary: text("expert_summary"),
	sources: text(),
	welcomeBenefit: text("welcome_benefit"),
}, (table) => [
	index("idx_cards_geography_active").on(table.geography, table.isActive),
	foreignKey({
			columns: [table.programId],
			foreignColumns: [programs.id],
			name: "cards_program_id_fkey"
		}).onDelete("cascade"),
]);
export const activeBonuses = pgView("active_bonuses", {	id: uuid(),
	transferPartnerId: uuid("transfer_partner_id"),
	bonusPct: integer("bonus_pct"),
	startDate: date("start_date"),
	endDate: date("end_date"),
	sourceUrl: text("source_url"),
	isVerified: boolean("is_verified"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	alertedAt: timestamp("alerted_at", { withTimezone: true, mode: 'string' }),
	autoDetected: boolean("auto_detected"),
	verified: boolean(),
	active: boolean(),
	fromProgramId: uuid("from_program_id"),
	toProgramId: uuid("to_program_id"),
	ratioFrom: integer("ratio_from"),
	ratioTo: integer("ratio_to"),
	fromProgramName: text("from_program_name"),
	fromProgramSlug: text("from_program_slug"),
	toProgramName: text("to_program_name"),
	toProgramSlug: text("to_program_slug"),
	isActiveNow: boolean("is_active_now"),
}).as(sql`SELECT tb.*, tp.from_program_id, tp.to_program_id, tp.ratio_from, tp.ratio_to, fp.name AS from_program_name, fp.slug AS from_program_slug, tp2.name AS to_program_name, tp2.slug AS to_program_slug, (CURRENT_DATE BETWEEN tb.start_date AND tb.end_date) AS is_active_now FROM transfer_bonuses tb JOIN transfer_partners tp ON tp.id = tb.transfer_partner_id JOIN programs fp ON fp.id = tp.from_program_id JOIN programs tp2 ON tp2.id = tp.to_program_id WHERE CURRENT_DATE BETWEEN tb.start_date AND tb.end_date AND COALESCE(tb.active, true) = true AND (COALESCE(tb.verified, false) = true OR COALESCE(tb.is_verified, false) = true)`);

export const siteStats = pgView("site_stats", {	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userCount: bigint("user_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	trackedPoints: bigint("tracked_points", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	optimizedValueCents: bigint("optimized_value_cents", { mode: "number" }),
}).as(sql`SELECT ( SELECT count(*) AS count FROM users) AS user_count, COALESCE(( SELECT sum(user_balances.balance)::bigint AS sum FROM user_balances), 0::bigint) AS tracked_points, COALESCE(( SELECT sum( CASE WHEN (shared_trips.trip_data ->> 'total_value_cents'::text) ~ '^[0-9]+$'::text THEN (shared_trips.trip_data ->> 'total_value_cents'::text)::bigint ELSE 0::bigint END)::bigint AS sum FROM shared_trips), 0::bigint) AS optimized_value_cents`);

export const latestValuations = pgView("latest_valuations", {	id: uuid(),
	programId: uuid("program_id"),
	cppCents: numeric("cpp_cents", { precision: 10, scale:  4 }),
	source: valuationSource(),
	sourceUrl: text("source_url"),
	effectiveDate: date("effective_date"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	programName: text("program_name"),
	programSlug: text("program_slug"),
	programType: programType("program_type"),
}).as(sql`SELECT DISTINCT ON (v.program_id) v.id, v.program_id, v.cpp_cents, v.source, v.source_url, v.effective_date, v.notes, v.created_at, p.name AS program_name, p.slug AS program_slug, p.type AS program_type FROM valuations v JOIN programs p ON p.id = v.program_id WHERE p.is_active = true ORDER BY v.program_id, v.effective_date DESC, v.created_at DESC`);
// ── Authentication (Better Auth) ─────────────────────────────
// IDs are UUIDs so accounts migrated from Supabase keep their auth IDs and
// users.auth_id keeps pointing at the right person.

export const authUser = pgTable("auth_user", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	unique("auth_user_email_key").on(table.email),
]);

export const authSession = pgTable("auth_session", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: uuid("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
}, (table) => [
	unique("auth_session_token_key").on(table.token),
	index("idx_auth_session_user").on(table.userId),
]);

export const authAccount = pgTable("auth_account", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: uuid("user_id").notNull().references(() => authUser.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("idx_auth_account_user").on(table.userId),
	unique("auth_account_provider_account_key").on(table.providerId, table.accountId),
]);

export const authVerification = pgTable("auth_verification", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("idx_auth_verification_identifier").on(table.identifier),
]);
