-- Migration 010: Flight Watches for Deal Scout Agent

CREATE TABLE public.flight_watches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  origin           TEXT NOT NULL,
  destination      TEXT NOT NULL,
  cabin            TEXT NOT NULL DEFAULT 'business',
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  max_points       INT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_checked_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flight_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own flight watches"
  ON public.flight_watches
  FOR ALL
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE INDEX idx_flight_watches_active ON public.flight_watches(is_active) WHERE is_active = true;
