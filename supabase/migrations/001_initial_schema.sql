-- ============================================================
-- PointsMax — Initial Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- ─────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────

CREATE TYPE program_type AS ENUM (
  'transferable_points',   -- Chase UR, Amex MR, Capital One, Citi, Bilt
  'airline_miles',         -- United, Delta, AA, etc.
  'hotel_points',          -- Hyatt, Marriott, Hilton, etc.
  'cashback'               -- Simple cash-back cards
);

CREATE TYPE redemption_category AS ENUM (
  'transfer_partner',      -- Transfer to airline/hotel
  'travel_portal',         -- Book via issuer portal (Chase Travel, Amex Travel)
  'statement_credit',      -- Applied to your bill
  'cashback',              -- Cash deposited
  'gift_cards',            -- Redeemed for gift cards
  'pay_with_points'        -- At checkout (Amazon, PayPal, etc.)
);

CREATE TYPE valuation_source AS ENUM (
  'tpg',           -- The Points Guy
  'nerdwallet',
  'manual'         -- Admin-entered
);

CREATE TYPE subscription_tier AS ENUM (
  'free',
  'premium'
);

-- ─────────────────────────────────────────────
-- TABLE: programs
-- Represents a loyalty currency (Chase UR, United Miles, etc.)
-- ─────────────────────────────────────────────

CREATE TABLE programs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,                -- "Chase Ultimate Rewards"
  short_name    TEXT NOT NULL,                -- "Chase UR"
  slug          TEXT NOT NULL UNIQUE,         -- "chase-ur" — used in URLs
  type          program_type NOT NULL,
  issuer        TEXT,                         -- "Chase", "American Express", etc.
  logo_url      TEXT,
  color_hex     TEXT DEFAULT '#6366f1',       -- Brand color for UI
  is_active     BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,       -- Sort order in dropdowns
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_programs_slug     ON programs(slug);
CREATE INDEX idx_programs_type     ON programs(type);
CREATE INDEX idx_programs_active   ON programs(is_active);

-- ─────────────────────────────────────────────
-- TABLE: valuations
-- Cents-per-point for each program, updated monthly
-- Multiple records over time → take latest per program
-- ─────────────────────────────────────────────

CREATE TABLE valuations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  cpp_cents        NUMERIC(6,4) NOT NULL,     -- e.g. 2.05 = 2.05 cents per point
  source           valuation_source NOT NULL DEFAULT 'manual',
  source_url       TEXT,                       -- Link to source article
  effective_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_valuations_program   ON valuations(program_id);
CREATE INDEX idx_valuations_date      ON valuations(effective_date DESC);

-- Convenience view: always get the latest valuation per program
CREATE VIEW latest_valuations AS
  SELECT DISTINCT ON (program_id)
    v.*,
    p.name        AS program_name,
    p.slug        AS program_slug,
    p.type        AS program_type
  FROM valuations v
  JOIN programs p ON p.id = v.program_id
  WHERE p.is_active = true
  ORDER BY program_id, effective_date DESC, created_at DESC;

-- ─────────────────────────────────────────────
-- TABLE: transfer_partners
-- Which programs can transfer to which, at what ratio
-- ─────────────────────────────────────────────

CREATE TABLE transfer_partners (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_program_id       UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  to_program_id         UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  ratio_from            INT NOT NULL DEFAULT 1,   -- e.g. 1 (send 1,000 points)
  ratio_to              INT NOT NULL DEFAULT 1,   -- e.g. 1 (receive 1,000 miles)
  min_transfer          INT NOT NULL DEFAULT 1000, -- minimum transfer amount
  transfer_increment    INT NOT NULL DEFAULT 1000, -- must transfer in multiples of this
  transfer_time_min_hrs INT NOT NULL DEFAULT 0,   -- instant = 0
  transfer_time_max_hrs INT NOT NULL DEFAULT 72,
  is_instant            BOOLEAN NOT NULL DEFAULT false,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(from_program_id, to_program_id)
);

CREATE INDEX idx_tp_from ON transfer_partners(from_program_id);
CREATE INDEX idx_tp_to   ON transfer_partners(to_program_id);

-- ─────────────────────────────────────────────
-- TABLE: transfer_bonuses
-- Limited-time bonus transfer promotions (e.g. "30% bonus to Air France")
-- ─────────────────────────────────────────────

CREATE TABLE transfer_bonuses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_partner_id UUID NOT NULL REFERENCES transfer_partners(id) ON DELETE CASCADE,
  bonus_pct           INT NOT NULL,            -- e.g. 30 means 30% more miles
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  source_url          TEXT,
  is_verified         BOOLEAN NOT NULL DEFAULT false,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bonus_pct_positive CHECK (bonus_pct > 0),
  CONSTRAINT bonus_dates_valid  CHECK (end_date >= start_date)
);

CREATE INDEX idx_bonuses_partner ON transfer_bonuses(transfer_partner_id);
CREATE INDEX idx_bonuses_dates   ON transfer_bonuses(start_date, end_date);

-- View: currently active bonuses with full context
CREATE VIEW active_bonuses AS
  SELECT
    tb.*,
    tp.from_program_id,
    tp.to_program_id,
    tp.ratio_from,
    tp.ratio_to,
    fp.name  AS from_program_name,
    fp.slug  AS from_program_slug,
    tp2.name AS to_program_name,
    tp2.slug AS to_program_slug,
    (CURRENT_DATE BETWEEN tb.start_date AND tb.end_date) AS is_active_now
  FROM transfer_bonuses tb
  JOIN transfer_partners tp  ON tp.id  = tb.transfer_partner_id
  JOIN programs fp            ON fp.id  = tp.from_program_id
  JOIN programs tp2           ON tp2.id = tp.to_program_id
  WHERE CURRENT_DATE BETWEEN tb.start_date AND tb.end_date;

-- ─────────────────────────────────────────────
-- TABLE: redemption_options
-- How each program can be redeemed (portal, cash, gift cards, etc.)
-- Separate from transfer_partners — these are direct redemptions
-- ─────────────────────────────────────────────

CREATE TABLE redemption_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  category     redemption_category NOT NULL,
  cpp_cents    NUMERIC(6,4) NOT NULL,    -- value you get in cents per point
  label        TEXT NOT NULL,            -- "Chase Travel Portal", "Cash Back"
  notes        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_redemption_program ON redemption_options(program_id);

-- ─────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL UNIQUE,
  tier             subscription_tier NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- TABLE: user_balances
-- What points a logged-in user has saved
-- ─────────────────────────────────────────────

CREATE TABLE user_balances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  balance     BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, program_id)
);

CREATE INDEX idx_balances_user    ON user_balances(user_id);
CREATE INDEX idx_balances_program ON user_balances(program_id);

-- ─────────────────────────────────────────────
-- TABLE: alert_subscriptions
-- Email list for transfer bonus alerts (works for guests too)
-- ─────────────────────────────────────────────

CREATE TABLE alert_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,  -- null if guest
  program_ids UUID[] NOT NULL DEFAULT '{}',                   -- which programs to alert on
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(email)
);

CREATE INDEX idx_alert_email  ON alert_subscriptions(email);
CREATE INDEX idx_alert_active ON alert_subscriptions(is_active);

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER (auto-updates updated_at column)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tp_updated_at
  BEFORE UPDATE ON transfer_partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
