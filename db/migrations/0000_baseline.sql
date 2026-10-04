CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."program_type" AS ENUM('transferable_points', 'airline_miles', 'hotel_points', 'cashback');--> statement-breakpoint
CREATE TYPE "public"."redemption_category" AS ENUM('transfer_partner', 'travel_portal', 'statement_credit', 'cashback', 'gift_cards', 'pay_with_points');--> statement-breakpoint
CREATE TYPE "public"."spend_category" AS ENUM('dining', 'groceries', 'travel', 'gas', 'streaming', 'other', 'shopping');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."valuation_source" AS ENUM('tpg', 'nerdwallet', 'manual', 'cardexpert', 'technofino');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid,
	"user_id" uuid,
	"source_page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"creator_slug" text,
	"rank" integer,
	"region" text
);
--> statement-breakpoint
CREATE TABLE "alert_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"program_ids" uuid[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_subscriptions_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_account_provider_account_key" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "auth_session_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connected_account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"balance" bigint NOT NULL,
	"source" text DEFAULT 'connector' NOT NULL,
	"provider_cursor" text,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_snapshots_balance_check" CHECK (balance >= 0),
	CONSTRAINT "balance_snapshots_source_check" CHECK (source = ANY (ARRAY['connector'::text, 'manual'::text]))
);
--> statement-breakpoint
CREATE TABLE "booking_guide_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"redemption_label" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_guide_sessions_current_step_check" CHECK (current_step_index >= 0),
	CONSTRAINT "booking_guide_sessions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'generating'::text, 'active'::text, 'completed'::text, 'timed_out'::text, 'failed'::text, 'cancelled'::text])),
	CONSTRAINT "booking_guide_sessions_total_steps_check" CHECK (total_steps >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_guide_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"step_index" integer NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completion_note" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_guide_steps_session_step_unique" UNIQUE("session_id","step_index"),
	CONSTRAINT "booking_guide_steps_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'current'::text, 'completed'::text, 'timed_out'::text, 'cancelled'::text])),
	CONSTRAINT "booking_guide_steps_step_index_check" CHECK (step_index >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_urls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_slug" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"region" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "booking_urls_region_check" CHECK (region = ANY (ARRAY['us'::text, 'in'::text, 'global'::text]))
);
--> statement-breakpoint
CREATE TABLE "card_earning_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"category" "spend_category" NOT NULL,
	"earn_multiplier" numeric(6, 2) NOT NULL,
	CONSTRAINT "card_earning_rates_card_id_category_key" UNIQUE("card_id","category")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"issuer" text NOT NULL,
	"annual_fee_usd" integer DEFAULT 0 NOT NULL,
	"signup_bonus_pts" integer DEFAULT 0 NOT NULL,
	"signup_bonus_spend" integer DEFAULT 0 NOT NULL,
	"program_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"apply_url" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"earn_unit" text DEFAULT '1_dollar' NOT NULL,
	"geography" text DEFAULT 'US' NOT NULL,
	"image_url" text,
	"earning_rates" text,
	"top_perks" text,
	"community_sentiment" text,
	"ideal_for" text,
	"recent_changes" text,
	"expert_summary" text,
	"sources" text,
	"welcome_benefit" text
);
--> statement-breakpoint
CREATE TABLE "cash_fare_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"cabin" text NOT NULL,
	"travel_date" text NOT NULL,
	"fare_usd" integer NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_cards_staging" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"issuer_name" text NOT NULL,
	"card_name" text NOT NULL,
	"card_slug_candidate" text NOT NULL,
	"program_name" text NOT NULL,
	"program_slug_candidate" text NOT NULL,
	"geography" text NOT NULL,
	"currency" text NOT NULL,
	"earn_unit" text NOT NULL,
	"catalog_status" text NOT NULL,
	"source_confidence" text NOT NULL,
	"seed_readiness" text NOT NULL,
	"image_asset_slug" text NOT NULL,
	"source_url" text NOT NULL,
	"source_scope" text NOT NULL,
	"official_image_strategy" text DEFAULT 'fetch_official_asset_then_self_host' NOT NULL,
	"official_image_status" text DEFAULT 'pending_asset_extraction' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_cards_staging_region_card_slug_candidate_key" UNIQUE("region","card_slug_candidate")
);
--> statement-breakpoint
CREATE TABLE "catalog_programs_staging" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"program_name" text NOT NULL,
	"short_name_candidate" text NOT NULL,
	"program_kind" text NOT NULL,
	"operator_name" text NOT NULL,
	"program_slug_candidate" text NOT NULL,
	"geography" text NOT NULL,
	"catalog_status" text NOT NULL,
	"source_confidence" text NOT NULL,
	"seed_readiness" text NOT NULL,
	"source_url" text NOT NULL,
	"source_scope" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_programs_staging_region_program_slug_candidate_key" UNIQUE("region","program_slug_candidate")
);
--> statement-breakpoint
CREATE TABLE "comparison_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"region" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"card_slugs" text[] NOT NULL,
	"category_focus" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "comparison_pages_slug_key" UNIQUE("slug"),
	CONSTRAINT "comparison_pages_region_check" CHECK (region = ANY (ARRAY['us'::text, 'in'::text]))
);
--> statement-breakpoint
CREATE TABLE "connected_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"display_name" text,
	"token_vault_ref" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"error_code" text,
	CONSTRAINT "uq_connected_accounts_user_provider_active" UNIQUE("user_id","provider"),
	CONSTRAINT "connected_accounts_error_code_check" CHECK (error_code = ANY (ARRAY['auth_error'::text, 'rate_limit'::text, 'provider_error'::text, 'unknown'::text])),
	CONSTRAINT "connected_accounts_status_check" CHECK (status = ANY (ARRAY['active'::text, 'expired'::text, 'revoked'::text, 'error'::text])),
	CONSTRAINT "connected_accounts_sync_status_check" CHECK (sync_status = ANY (ARRAY['pending'::text, 'syncing'::text, 'ok'::text, 'error'::text, 'stale'::text]))
);
--> statement-breakpoint
CREATE TABLE "connector_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"actor" text DEFAULT 'user' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connector_audit_log_actor_check" CHECK (actor = ANY (ARRAY['user'::text, 'system'::text, 'admin'::text])),
	CONSTRAINT "connector_audit_log_event_type_check" CHECK (event_type = ANY (ARRAY['connect'::text, 'disconnect'::text, 'sync'::text, 'manual_override'::text, 'delete'::text, 'token_revoke'::text, 'auth_error'::text]))
);
--> statement-breakpoint
CREATE TABLE "creator_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_slug" text NOT NULL,
	"user_id" uuid,
	"converted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan" text DEFAULT 'premium' NOT NULL,
	"revenue_usd" integer DEFAULT 999 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"platform" text,
	"profile_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creators_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dead_letter_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"function_id" text NOT NULL,
	"event_name" text NOT NULL,
	"payload" jsonb,
	"error_message" text DEFAULT '' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_attempted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	CONSTRAINT "dead_letter_queue_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'retrying'::text, 'resolved'::text]))
);
--> statement-breakpoint
CREATE TABLE "flight_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"cabin" text DEFAULT 'business' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"max_points" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hotel_award_charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"destination_region" text NOT NULL,
	"tier_label" text NOT NULL,
	"tier_number" integer NOT NULL,
	"points_off_peak" integer,
	"points_standard" integer NOT NULL,
	"points_peak" integer,
	"estimated_cash_usd" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotel_award_charts_program_id_destination_region_tier_numbe_key" UNIQUE("program_id","destination_region","tier_number"),
	CONSTRAINT "hotel_award_charts_destination_region_check" CHECK (destination_region = ANY (ARRAY['north_america'::text, 'europe'::text, 'middle_east_africa'::text, 'asia_pacific'::text, 'latin_america'::text, 'india'::text]))
);
--> statement-breakpoint
CREATE TABLE "hotel_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"chain" text NOT NULL,
	"geography" text DEFAULT 'GLOBAL' NOT NULL,
	"color_hex" text,
	"booking_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hotel_programs_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_data" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT (now() + '24:00:00'::interval) NOT NULL,
	CONSTRAINT "idempotency_keys_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
CREATE TABLE "inspiration_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"region" text NOT NULL,
	"origin_iata" text,
	"destination_iata" text NOT NULL,
	"destination_label" text NOT NULL,
	"cabin" text NOT NULL,
	"program_slug" text NOT NULL,
	"miles_required" integer NOT NULL,
	"estimated_cash_value_usd" integer NOT NULL,
	"cpp_cents" numeric NOT NULL,
	"headline" text NOT NULL,
	"description" text NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspiration_routes_region_check" CHECK (region = ANY (ARRAY['US'::text, 'IN'::text, 'GLOBAL'::text]))
);
--> statement-breakpoint
CREATE TABLE "knowledge_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_health_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"card_id" uuid,
	"url" text NOT NULL,
	"status_code" integer,
	"ok" boolean NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"email_kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "program_name_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_slug" text NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "program_name_aliases_alias_key" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "program_slug_aliases" (
	"alias_slug" text PRIMARY KEY NOT NULL,
	"canonical_slug" text NOT NULL,
	"geography" text DEFAULT 'global' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "program_type" NOT NULL,
	"issuer" text,
	"logo_url" text,
	"color_hex" text DEFAULT '#6366f1',
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"geography" text DEFAULT 'global' NOT NULL,
	"best_uses" text[] DEFAULT '{}' NOT NULL,
	"transfer_partners" jsonb,
	"best_redemption" text,
	"worst_redemption" text,
	CONSTRAINT "programs_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "redemption_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"category" "redemption_category" NOT NULL,
	"cpp_cents" numeric(10, 4) NOT NULL,
	"label" text NOT NULL,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_trips" (
	"id" text PRIMARY KEY NOT NULL,
	"region" text NOT NULL,
	"trip_data" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"stripe_customer_id" text,
	"event_type" text NOT NULL,
	"previous_tier" text,
	"new_tier" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "transfer_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_partner_id" uuid NOT NULL,
	"bonus_pct" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"source_url" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"alerted_at" timestamp with time zone,
	"auto_detected" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "bonus_dates_valid" CHECK (end_date >= start_date),
	CONSTRAINT "bonus_pct_positive" CHECK (bonus_pct > 0)
);
--> statement-breakpoint
CREATE TABLE "transfer_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_program_id" uuid NOT NULL,
	"to_program_id" uuid NOT NULL,
	"ratio_from" integer DEFAULT 1 NOT NULL,
	"ratio_to" integer DEFAULT 1 NOT NULL,
	"min_transfer" integer DEFAULT 1000 NOT NULL,
	"transfer_increment" integer DEFAULT 1000 NOT NULL,
	"transfer_time_min_hrs" integer DEFAULT 0 NOT NULL,
	"transfer_time_max_hrs" integer DEFAULT 72 NOT NULL,
	"is_instant" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_partners_from_program_id_to_program_id_key" UNIQUE("from_program_id","to_program_id")
);
--> statement-breakpoint
CREATE TABLE "user_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_balances_user_id_program_id_key" UNIQUE("user_id","program_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"home_airport" text,
	"preferred_cabin" text DEFAULT 'any',
	"preferred_airlines" text[] DEFAULT '{}',
	"avoided_airlines" text[] DEFAULT '{}',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"digest_email_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"auth_id" uuid,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_auth_id_key" UNIQUE("auth_id")
);
--> statement-breakpoint
CREATE TABLE "valuations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"cpp_cents" numeric(10, 4) NOT NULL,
	"source" "valuation_source" DEFAULT 'manual' NOT NULL,
	"source_url" text,
	"effective_date" date DEFAULT CURRENT_DATE NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_creator_slug_fkey" FOREIGN KEY ("creator_slug") REFERENCES "public"."creators"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_subscriptions" ADD CONSTRAINT "alert_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_connected_account_id_fkey" FOREIGN KEY ("connected_account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_guide_sessions" ADD CONSTRAINT "booking_guide_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_guide_steps" ADD CONSTRAINT "booking_guide_steps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."booking_guide_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_earning_rates" ADD CONSTRAINT "card_earning_rates_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_audit_log" ADD CONSTRAINT "connector_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_audit_log" ADD CONSTRAINT "connector_audit_log_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."connected_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_conversions" ADD CONSTRAINT "creator_conversions_creator_slug_fkey" FOREIGN KEY ("creator_slug") REFERENCES "public"."creators"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_conversions" ADD CONSTRAINT "creator_conversions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flight_watches" ADD CONSTRAINT "flight_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_award_charts" ADD CONSTRAINT "hotel_award_charts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."hotel_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_health_log" ADD CONSTRAINT "link_health_log_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_email_log" ADD CONSTRAINT "onboarding_email_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_name_aliases" ADD CONSTRAINT "program_name_aliases_program_slug_fkey" FOREIGN KEY ("program_slug") REFERENCES "public"."programs"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemption_options" ADD CONSTRAINT "redemption_options_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_trips" ADD CONSTRAINT "shared_trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_bonuses" ADD CONSTRAINT "transfer_bonuses_transfer_partner_id_fkey" FOREIGN KEY ("transfer_partner_id") REFERENCES "public"."transfer_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_partners" ADD CONSTRAINT "transfer_partners_from_program_id_fkey" FOREIGN KEY ("from_program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_partners" ADD CONSTRAINT "transfer_partners_to_program_id_fkey" FOREIGN KEY ("to_program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_auth_user_id_fk" FOREIGN KEY ("auth_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuations" ADD CONSTRAINT "valuations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_action" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_log_created_at" ON "admin_audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_affiliate_clicks_card_source" ON "affiliate_clicks" USING btree ("card_id","source_page");--> statement-breakpoint
CREATE INDEX "idx_affiliate_clicks_created_at" ON "affiliate_clicks" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_affiliate_clicks_creator_slug" ON "affiliate_clicks" USING btree ("creator_slug","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_affiliate_clicks_region" ON "affiliate_clicks" USING btree ("region");--> statement-breakpoint
CREATE INDEX "idx_alert_active" ON "alert_subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_alert_email" ON "alert_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_alert_subscriptions_user_id" ON "alert_subscriptions" USING btree ("user_id") WHERE (user_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_auth_account_user" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_session_user" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_verification_identifier" ON "auth_verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "idx_balance_snapshots_account_time" ON "balance_snapshots" USING btree ("connected_account_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_balance_snapshots_user_program_time" ON "balance_snapshots" USING btree ("user_id","program_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_booking_guide_sessions_user_created" ON "booking_guide_sessions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_booking_guide_steps_session_step" ON "booking_guide_steps" USING btree ("session_id","step_index");--> statement-breakpoint
CREATE INDEX "idx_cards_geography_active" ON "cards" USING btree ("geography","is_active");--> statement-breakpoint
CREATE INDEX "idx_catalog_cards_staging_region" ON "catalog_cards_staging" USING btree ("region","catalog_status");--> statement-breakpoint
CREATE INDEX "idx_catalog_programs_staging_region" ON "catalog_programs_staging" USING btree ("region","catalog_status");--> statement-breakpoint
CREATE INDEX "idx_comparison_pages_region" ON "comparison_pages" USING btree ("region","is_published","display_order");--> statement-breakpoint
CREATE INDEX "idx_connected_accounts_active_sync" ON "connected_accounts" USING btree ("last_synced_at" NULLS FIRST) WHERE (status = 'active'::text);--> statement-breakpoint
CREATE INDEX "idx_connected_accounts_provider" ON "connected_accounts" USING btree ("provider","status");--> statement-breakpoint
CREATE INDEX "idx_connected_accounts_sync_status" ON "connected_accounts" USING btree ("sync_status","last_synced_at" NULLS FIRST) WHERE (status = 'active'::text);--> statement-breakpoint
CREATE INDEX "idx_connected_accounts_user_id" ON "connected_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_connector_audit_log_account_time" ON "connector_audit_log" USING btree ("account_id","created_at" DESC NULLS LAST) WHERE (account_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_connector_audit_log_event_type" ON "connector_audit_log" USING btree ("event_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_connector_audit_log_user_time" ON "connector_audit_log" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_creator_conversions_slug" ON "creator_conversions" USING btree ("creator_slug","converted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_creator_conversions_user" ON "creator_conversions" USING btree ("user_id","converted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_dlq_function_id" ON "dead_letter_queue" USING btree ("function_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_dlq_status_created" ON "dead_letter_queue" USING btree ("status","created_at" DESC NULLS LAST) WHERE (status = ANY (ARRAY['pending'::text, 'retrying'::text]));--> statement-breakpoint
CREATE INDEX "idx_flight_watches_active" ON "flight_watches" USING btree ("is_active") WHERE (is_active = true);--> statement-breakpoint
CREATE INDEX "idx_flight_watches_user_id" ON "flight_watches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_hotel_award_charts_program_region" ON "hotel_award_charts" USING btree ("program_id","destination_region","tier_number");--> statement-breakpoint
CREATE INDEX "idx_hotel_programs_active" ON "hotel_programs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_hotel_programs_slug" ON "hotel_programs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_expires" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_idempotency_keys_key_status_expires" ON "idempotency_keys" USING btree ("key","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_inspiration_routes_unique" ON "inspiration_routes" USING btree ("region","origin_iata","destination_iata","cabin","program_slug","headline");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_knowledge_docs_source_hash" ON "knowledge_docs" USING btree ("source_id","content_hash");--> statement-breakpoint
CREATE INDEX "knowledge_docs_embedding_idx" ON "knowledge_docs" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);--> statement-breakpoint
CREATE INDEX "idx_link_health_log_checked_at" ON "link_health_log" USING btree ("checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_link_health_log_ok" ON "link_health_log" USING btree ("ok","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_link_health_log_run_id" ON "link_health_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_onboarding_email_log_sent_at" ON "onboarding_email_log" USING btree ("sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_onboarding_email_log_unique" ON "onboarding_email_log" USING btree ("user_id","email_kind");--> statement-breakpoint
CREATE INDEX "idx_program_name_aliases_slug" ON "program_name_aliases" USING btree ("program_slug");--> statement-breakpoint
CREATE INDEX "idx_program_slug_aliases_canonical" ON "program_slug_aliases" USING btree ("canonical_slug");--> statement-breakpoint
CREATE INDEX "idx_programs_active" ON "programs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_programs_geography" ON "programs" USING btree ("geography");--> statement-breakpoint
CREATE INDEX "idx_programs_slug" ON "programs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_programs_type" ON "programs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_redemption_program" ON "redemption_options" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_shared_trips_created_at" ON "shared_trips" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_subscription_events_customer" ON "subscription_events" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_user_id" ON "subscription_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bonuses_alerted" ON "transfer_bonuses" USING btree ("alerted_at") WHERE (alerted_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_bonuses_dates" ON "transfer_bonuses" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_bonuses_partner" ON "transfer_bonuses" USING btree ("transfer_partner_id");--> statement-breakpoint
CREATE INDEX "idx_tp_from" ON "transfer_partners" USING btree ("from_program_id");--> statement-breakpoint
CREATE INDEX "idx_tp_to" ON "transfer_partners" USING btree ("to_program_id");--> statement-breakpoint
CREATE INDEX "idx_balances_program" ON "user_balances" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_balances_user" ON "user_balances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_last_seen_at" ON "users" USING btree ("last_seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_valuations_date" ON "valuations" USING btree ("effective_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_valuations_program" ON "valuations" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_valuations_program_date_source" ON "valuations" USING btree ("program_id","effective_date","source");--> statement-breakpoint
CREATE VIEW "public"."active_bonuses" AS (SELECT tb.*, tp.from_program_id, tp.to_program_id, tp.ratio_from, tp.ratio_to, fp.name AS from_program_name, fp.slug AS from_program_slug, tp2.name AS to_program_name, tp2.slug AS to_program_slug, (CURRENT_DATE BETWEEN tb.start_date AND tb.end_date) AS is_active_now FROM transfer_bonuses tb JOIN transfer_partners tp ON tp.id = tb.transfer_partner_id JOIN programs fp ON fp.id = tp.from_program_id JOIN programs tp2 ON tp2.id = tp.to_program_id WHERE CURRENT_DATE BETWEEN tb.start_date AND tb.end_date AND COALESCE(tb.active, true) = true AND (COALESCE(tb.verified, false) = true OR COALESCE(tb.is_verified, false) = true));--> statement-breakpoint
CREATE VIEW "public"."latest_valuations" AS (SELECT DISTINCT ON (v.program_id) v.id, v.program_id, v.cpp_cents, v.source, v.source_url, v.effective_date, v.notes, v.created_at, p.name AS program_name, p.slug AS program_slug, p.type AS program_type FROM valuations v JOIN programs p ON p.id = v.program_id WHERE p.is_active = true ORDER BY v.program_id, v.effective_date DESC, v.created_at DESC);--> statement-breakpoint
CREATE VIEW "public"."site_stats" AS (SELECT ( SELECT count(*) AS count FROM users) AS user_count, COALESCE(( SELECT sum(user_balances.balance)::bigint AS sum FROM user_balances), 0::bigint) AS tracked_points, COALESCE(( SELECT sum( CASE WHEN (shared_trips.trip_data ->> 'total_value_cents'::text) ~ '^[0-9]+$'::text THEN (shared_trips.trip_data ->> 'total_value_cents'::text)::bigint ELSE 0::bigint END)::bigint AS sum FROM shared_trips), 0::bigint) AS optimized_value_cents);