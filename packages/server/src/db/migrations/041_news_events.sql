-- News Events: server-wide broadcast events for the NEWS monitor
CREATE TABLE IF NOT EXISTS news_events (
  id           SERIAL PRIMARY KEY,
  event_type   VARCHAR(64) NOT NULL,
  headline     VARCHAR(255) NOT NULL,
  summary      TEXT,
  event_data   JSONB,
  player_id    VARCHAR(255),
  player_name  VARCHAR(255),
  quadrant_x   INTEGER,
  quadrant_y   INTEGER,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_events_created ON news_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_type ON news_events (event_type);
