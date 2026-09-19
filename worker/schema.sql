CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT, -- required for new accounts, missing on ones made before password resets existed
  pw_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users(email COLLATE NOCASE);

-- RuneScape names owned by an account; used as bingo players and to find a team's captains
CREATE TABLE IF NOT EXISTS rsns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS rsns_name ON rsns(name COLLATE NOCASE);

-- password reset links, valid 15 minutes
CREATE TABLE IF NOT EXISTS resets (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

-- login/register throttle: one row per IP, 10 tries then a cooldown until reset
CREATE TABLE IF NOT EXISTS attempts (
  ip TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset INTEGER NOT NULL -- ms epoch
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
  data BLOB NOT NULL,
  created INTEGER -- ms epoch
);
