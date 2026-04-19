-- TRAKR AI: cross-device CoachGPT chat persistence
-- Run this once in Supabase → SQL Editor → New query.
-- Safe to re-run; uses IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS public.chat_history (
  id BIGSERIAL PRIMARY KEY,
  surface TEXT NOT NULL DEFAULT 'main',
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_history_surface_created_idx
  ON public.chat_history (surface, created_at);

ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Single-user app uses the anon key for all access (matches daily_logs / user_settings).
DROP POLICY IF EXISTS "anon read chat_history" ON public.chat_history;
CREATE POLICY "anon read chat_history"
  ON public.chat_history FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon insert chat_history" ON public.chat_history;
CREATE POLICY "anon insert chat_history"
  ON public.chat_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete chat_history" ON public.chat_history;
CREATE POLICY "anon delete chat_history"
  ON public.chat_history FOR DELETE
  TO anon, authenticated
  USING (true);
