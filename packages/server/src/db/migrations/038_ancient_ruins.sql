-- Ancient Ruins: track discovered lore fragments per player
CREATE TABLE IF NOT EXISTS ancient_lore_fragments (
  player_id VARCHAR(255) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  fragment_index INTEGER NOT NULL, -- 0-based index into ANCIENT_LORE_FRAGMENTS
  ruin_level INTEGER NOT NULL DEFAULT 1,
  artefact_found BOOLEAN NOT NULL DEFAULT FALSE,
  discovered_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  PRIMARY KEY (player_id, sector_x, sector_y)
);

CREATE INDEX IF NOT EXISTS idx_ancient_fragments_player ON ancient_lore_fragments(player_id);
CREATE INDEX IF NOT EXISTS idx_ancient_fragments_fragment ON ancient_lore_fragments(fragment_index);
