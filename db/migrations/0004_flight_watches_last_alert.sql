ALTER TABLE "flight_watches" ADD COLUMN "last_alert_key" text;--> statement-breakpoint
ALTER TABLE "flight_watches" ADD COLUMN "last_alerted_at" timestamp with time zone;