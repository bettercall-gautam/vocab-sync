CREATE TABLE IF NOT EXISTS drive_connection (
  owner_key TEXT PRIMARY KEY,
  google_subject TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  refresh_token_iv TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS browser_session (
  session_hash TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS browser_session_owner_idx
  ON browser_session(owner_key);
