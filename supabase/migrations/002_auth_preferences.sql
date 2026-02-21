-- Migration 002: Auth integration + user preferences
-- Run this in Supabase SQL Editor after enabling Google OAuth

-- 1. Link users table to Supabase Auth
ALTER TABLE users ADD COLUMN auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Auto-create users row when someone signs up via OAuth
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (auth_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (email) DO UPDATE SET auth_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- 3. User preferences table
CREATE TABLE user_preferences (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  home_airport        TEXT,
  preferred_cabin     TEXT DEFAULT 'any',  -- 'economy' | 'business' | 'first' | 'any'
  preferred_airlines  TEXT[] DEFAULT '{}', -- e.g. ['United', 'Delta']
  avoided_airlines    TEXT[] DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile" ON users
  FOR SELECT USING (
    auth_id = auth.uid()
  );

CREATE POLICY "Users see own balances" ON user_balances
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users see own preferences" ON user_preferences
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );
