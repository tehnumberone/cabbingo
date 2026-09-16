CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pw_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  end_date INTEGER NOT NULL, -- ms epoch, drives archive
  config TEXT NOT NULL -- Board JSON, team captains stored as captainIds
);

CREATE TABLE IF NOT EXISTS progress (
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  tile_id TEXT NOT NULL,
  data TEXT NOT NULL, -- Progress JSON
  PRIMARY KEY (board_id, team_id, tile_id)
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  data BLOB NOT NULL
);
