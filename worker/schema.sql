-- Wishrack database (Cloudflare D1). Safe to run more than once.
CREATE TABLE IF NOT EXISTS items (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,      -- the item as JSON
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,   -- random 32-character id
  mime       TEXT NOT NULL,
  data       BLOB NOT NULL,      -- a small JPEG made in the app (about 50 to 150 KB)
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,   -- 'profile': the owner's name and photo id
  data       TEXT NOT NULL,      -- JSON
  updated_at INTEGER NOT NULL
);
