-- ============================================================
-- PointsMax — Migration 014
-- Knowledge base hardening (dedupe + richer retrieval payload)
-- ============================================================

ALTER TABLE public.knowledge_docs
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

UPDATE public.knowledge_docs
SET content_hash = md5(content)
WHERE content_hash IS NULL OR content_hash = '';

ALTER TABLE public.knowledge_docs
  ALTER COLUMN content_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_docs_source_hash
  ON public.knowledge_docs (source_id, content_hash);

-- Extend vector search RPC to return metadata useful for citations.
-- NOTE: return type changed from migration 013, so we must drop first.
DROP FUNCTION IF EXISTS public.search_knowledge_docs(vector, double precision, integer);
DROP FUNCTION IF EXISTS public.search_knowledge_docs(vector, real, integer);

CREATE FUNCTION public.search_knowledge_docs(
  query_embedding vector(768),
  match_threshold double precision,
  match_count int
)
RETURNS TABLE (
  id uuid,
  source_id text,
  source_url text,
  title text,
  content text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id,
    d.source_id,
    d.source_url,
    d.title,
    d.content,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_docs d
  WHERE d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT GREATEST(match_count, 1);
$$;
