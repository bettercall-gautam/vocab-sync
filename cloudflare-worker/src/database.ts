export const OWNER_KEY = "primary";

export type DriveConnection = {
  owner_key: string;
  google_subject: string;
  owner_email: string;
  encrypted_refresh_token: string;
  refresh_token_iv: string;
  granted_scopes: string;
  key_version: number;
  created_at: number;
  updated_at: number;
};

export type BrowserSession = {
  session_hash: string;
  owner_key: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
  revoked_at: number | null;
};

export type ReviewStateDocument = {
  owner_key: string;
  version: number;
  payload: string;
  updated_at: number;
};

export const getDriveConnection = async (db: D1Database): Promise<DriveConnection | null> =>
  db.prepare("SELECT * FROM drive_connection WHERE owner_key = ? LIMIT 1").bind(OWNER_KEY).first<DriveConnection>();

export const saveDriveConnection = async (
  db: D1Database,
  connection: Omit<DriveConnection, "owner_key" | "created_at" | "updated_at">,
): Promise<void> => {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO drive_connection (
        owner_key, google_subject, owner_email, encrypted_refresh_token, refresh_token_iv,
        granted_scopes, key_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner_key) DO UPDATE SET
        google_subject = excluded.google_subject,
        owner_email = excluded.owner_email,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        refresh_token_iv = excluded.refresh_token_iv,
        granted_scopes = excluded.granted_scopes,
        key_version = excluded.key_version,
        updated_at = excluded.updated_at`,
    )
    .bind(
      OWNER_KEY,
      connection.google_subject,
      connection.owner_email,
      connection.encrypted_refresh_token,
      connection.refresh_token_iv,
      connection.granted_scopes,
      connection.key_version,
      now,
      now,
    )
    .run();
};

export const createBrowserSession = async (
  db: D1Database,
  sessionHash: string,
  expiresAt: number,
): Promise<void> => {
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO browser_session (session_hash, owner_key, created_at, last_used_at, expires_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
    .bind(sessionHash, OWNER_KEY, now, now, expiresAt)
    .run();
};

export const getActiveBrowserSession = async (
  db: D1Database,
  sessionHash: string,
): Promise<BrowserSession | null> => {
  const now = Date.now();
  const session = await db
    .prepare(
      `SELECT * FROM browser_session
       WHERE session_hash = ? AND owner_key = ? AND revoked_at IS NULL AND expires_at > ?
       LIMIT 1`,
    )
    .bind(sessionHash, OWNER_KEY, now)
    .first<BrowserSession>();

  if (session) {
    await db.prepare("UPDATE browser_session SET last_used_at = ? WHERE session_hash = ?").bind(now, sessionHash).run();
  }

  return session;
};

export const revokeBrowserSession = async (db: D1Database, sessionHash: string): Promise<void> => {
  await db.prepare("UPDATE browser_session SET revoked_at = ? WHERE session_hash = ?").bind(Date.now(), sessionHash).run();
};

export const deleteConnectionAndSessions = async (db: D1Database): Promise<void> => {
  await db.batch([
    db.prepare("DELETE FROM browser_session WHERE owner_key = ?").bind(OWNER_KEY),
    db.prepare("DELETE FROM drive_connection WHERE owner_key = ?").bind(OWNER_KEY),
  ]);
};

export const getReviewState = async (db: D1Database): Promise<ReviewStateDocument | null> =>
  db.prepare("SELECT * FROM review_state WHERE owner_key = ? LIMIT 1").bind(OWNER_KEY).first<ReviewStateDocument>();

export const saveReviewState = async (
  db: D1Database,
  expectedVersion: number,
  payload: string,
): Promise<ReviewStateDocument | null> => {
  const now = Date.now();
  if (expectedVersion === 0) {
    const created = await db
      .prepare("INSERT INTO review_state (owner_key, version, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_key) DO NOTHING")
      .bind(OWNER_KEY, 1, payload, now)
      .run();
    if ((created.meta.changes ?? 0) !== 1) return null;
    return { owner_key: OWNER_KEY, version: 1, payload, updated_at: now };
  }

  const updated = await db
    .prepare("UPDATE review_state SET version = version + 1, payload = ?, updated_at = ? WHERE owner_key = ? AND version = ?")
    .bind(payload, now, OWNER_KEY, expectedVersion)
    .run();
  if ((updated.meta.changes ?? 0) !== 1) return null;
  return { owner_key: OWNER_KEY, version: expectedVersion + 1, payload, updated_at: now };
};
