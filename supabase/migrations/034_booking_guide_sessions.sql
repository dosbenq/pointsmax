-- Migration 034: Booking guide workflow state

CREATE TABLE IF NOT EXISTS public.booking_guide_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  redemption_label   TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  current_step_index INT NOT NULL DEFAULT 0,
  total_steps        INT NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  last_error         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_guide_sessions_status_check
    CHECK (status IN ('pending', 'generating', 'active', 'completed', 'timed_out', 'failed', 'cancelled')),
  CONSTRAINT booking_guide_sessions_current_step_check
    CHECK (current_step_index >= 0),
  CONSTRAINT booking_guide_sessions_total_steps_check
    CHECK (total_steps >= 0)
);

CREATE TABLE IF NOT EXISTS public.booking_guide_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.booking_guide_sessions(id) ON DELETE CASCADE,
  step_index      INT NOT NULL,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  completion_note TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_guide_steps_status_check
    CHECK (status IN ('pending', 'current', 'completed', 'timed_out', 'cancelled')),
  CONSTRAINT booking_guide_steps_step_index_check
    CHECK (step_index >= 0),
  CONSTRAINT booking_guide_steps_session_step_unique
    UNIQUE (session_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_booking_guide_sessions_user_created
  ON public.booking_guide_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_guide_steps_session_step
  ON public.booking_guide_steps (session_id, step_index);

ALTER TABLE public.booking_guide_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_guide_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own booking guide sessions"
  ON public.booking_guide_sessions
  FOR ALL
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users manage own booking guide steps"
  ON public.booking_guide_steps
  FOR ALL
  USING (
    session_id IN (
      SELECT id
      FROM public.booking_guide_sessions
      WHERE user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id
      FROM public.booking_guide_sessions
      WHERE user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );
