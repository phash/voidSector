ALTER TABLE quadrants ADD COLUMN IF NOT EXISTS content_variance FLOAT DEFAULT 1.0;
CREATE INDEX IF NOT EXISTS idx_quadrants_content_variance ON quadrants(content_variance);
