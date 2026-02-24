-- Migration 013: Vector Search Function
-- RPC function to search knowledge_docs by cosine similarity

CREATE OR REPLACE FUNCTION search_knowledge_docs(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_docs.id,
    knowledge_docs.content,
    1 - (knowledge_docs.embedding <=> query_embedding) as similarity
  FROM knowledge_docs
  WHERE 1 - (knowledge_docs.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
