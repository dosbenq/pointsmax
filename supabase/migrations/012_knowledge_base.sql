-- ============================================================
-- PointsMax — Migration 012
-- Knowledge Base: pgvector setup for AI Expert Agent
-- ============================================================

-- 1) Enable Vector Extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Create Knowledge Docs Table (Stores raw chunks + embeddings)
CREATE TABLE public.knowledge_docs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       TEXT NOT NULL,                 -- e.g. "youtube:VIDEO_ID"
  source_url      TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,                 -- The chunk of transcript/text
  embedding       vector(768),                   -- Gemini 1.5 embedding dimension
  metadata        JSONB DEFAULT '{}'::jsonb,     -- Extra info (published_at, channel, tags)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Create Index for Fast Similarity Search
CREATE INDEX ON public.knowledge_docs USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4) RLS: Public read (for now), Admin write
ALTER TABLE public.knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read knowledge base"
  ON public.knowledge_docs
  FOR SELECT
  USING (true);

-- (Admin write policy handled by service role key in ingest functions)
