CREATE TABLE IF NOT EXISTS review_state (
  owner_key TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
