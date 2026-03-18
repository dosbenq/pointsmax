-- ============================================================
-- PointsMax — Align comparison_pages RLS with project convention
-- ============================================================

ALTER TABLE comparison_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages comparison pages" ON comparison_pages;

CREATE POLICY "Service role manages comparison pages"
  ON comparison_pages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
