CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  sport TEXT NOT NULL CHECK (sport IN ('basket', 'foot')),
  external_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT,
  home_team_json TEXT NOT NULL,
  away_team_json TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  season TEXT,
  league TEXT,
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (sport, external_id)
);

CREATE TABLE IF NOT EXISTS box_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  team_id TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  UNIQUE (game_id, entity_id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_order INTEGER NOT NULL,
  clock TEXT NOT NULL,
  period INTEGER NOT NULL,
  period_label TEXT NOT NULL,
  type TEXT NOT NULL,
  team_id TEXT,
  description TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  actor_ids_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT,
  UNIQUE (game_id, event_order)
);

CREATE TABLE IF NOT EXISTS context_blocks (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  summary_text TEXT NOT NULL,
  entity_ids_json TEXT NOT NULL DEFAULT '[]',
  period INTEGER,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS shot_charts (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  points_json TEXT NOT NULL,
  PRIMARY KEY (game_id, entity_id)
);

CREATE TABLE IF NOT EXISTS momentum (
  game_id TEXT PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
  points_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_box_lines_game ON box_lines(game_id);
CREATE INDEX IF NOT EXISTS idx_timeline_game ON timeline_events(game_id);
CREATE INDEX IF NOT EXISTS idx_context_game ON context_blocks(game_id);
