# Persistent Google Drive Connection Design

**Status:** Approved architecture, awaiting Cloudflare account creation and Google credential setup.  
**Scope:** One owner, one encrypted Google Drive refresh-token record, and persistent browser sessions for Vocab Sync.

## Purpose and constraint

The current GitHub Pages app correctly avoids storing Google Drive tokens in the browser. That security boundary is also why Google access disappears when the browser restarts. A Google OAuth refresh token must be stored on a trusted server if the app is to obtain fresh one-hour Drive access tokens without a new Drive sign-in.[1]

The selected solution keeps the frontend on GitHub Pages and adds a minimal **Cloudflare Worker plus D1** service. The Worker owns all Google OAuth secrets, encrypts the refresh token before storage, and issues short-lived Drive access tokens only to an authenticated browser session.

## Design review

| Area | Current state | Required improvement | Decision |
|---|---|---|---|
| Frontend hosting | Static GitHub Pages site is live and working. | Do not disrupt the existing app while adding persistence. | Keep GitHub Pages unchanged as the frontend host. |
| Google credential | The browser-only OAuth credential is not suitable for holding a long-lived server secret. | A server-only web OAuth client credential is necessary. | Create or rotate a dedicated Google web OAuth client before deployment. |
| Token persistence | No Drive token is stored. | A refresh token must survive a browser restart. | Encrypt the refresh token in D1, never in GitHub, the browser, logs, or source code. |
| Browser identity | There is no persistent backend session today. | The Worker needs to know which browser may ask for an access token. | Store a random, opaque browser session handle locally. Store only its SHA-256 hash in D1. |
| Public app risk | The GitHub Pages app is public. | Another person must not replace or use the owner’s Drive connection. | Verify the Google account against an owner email stored as a Worker secret and require a random browser-session handle for token requests. |

The current app quality is **8/10** for its browser-only purpose. The remaining weakness is not a bug in its UI or Drive logic. It is an intentional security limit of browser-only OAuth. The new Worker is the smallest change that addresses that limit without turning Vocab Sync into a needlessly complicated full-stack application.

## Components and trust boundaries

```text
Browser on GitHub Pages
  Stores: local drafts, settings, destination metadata, opaque session handle
  Never stores: Google refresh token, Google client secret, encryption key
        |
        | HTTPS with exact-origin CORS checks
        v
Cloudflare Worker
  Stores as Cloudflare secrets: Google client secret, token-encryption key,
  approved owner Google email, allowed frontend origin
        |
        | encrypted token ciphertext and hashed browser sessions
        v
Cloudflare D1
        |
        | OAuth code exchange and refresh grant only
        v
Google OAuth and Drive APIs
```

> The browser receives a short-lived Google Drive access token only when it presents its own opaque Vocab Sync session handle. The Google refresh token remains encrypted on the Worker side.

## OAuth and session flow

| Step | Action | Security purpose |
|---|---|---|
| 1 | The user selects **Connect Drive** once on a device. The frontend opens the Worker’s `/auth/google/start` endpoint in the top-level browser window. | Starts the OAuth code flow on the domain that owns the client secret. |
| 2 | The Worker creates a random state value, puts it in a short-lived secure, HTTP-only, same-site cookie, then redirects to Google. | Binds the callback to the browser request and prevents OAuth request forgery. |
| 3 | Google redirects to `/auth/google/callback` with an authorization code. | The code is delivered only to the Worker redirect URI registered in Google Cloud. |
| 4 | The Worker validates state, exchanges the code using its client secret, and confirms that the Google user email equals the approved owner email. | Prevents a different Google account from replacing the single owner’s connection. |
| 5 | The Worker encrypts the refresh token with AES-GCM and stores the ciphertext, IV, account subject, scopes, and timestamps in D1. | D1 alone cannot reveal the reusable Google credential. |
| 6 | The Worker creates a random device session token, stores only its SHA-256 hash in D1, and returns the raw token in a URL fragment. | The fragment is not sent in HTTP requests. The frontend immediately removes it from browser history and stores it locally. |
| 7 | On later app loads, the frontend calls `POST /session/access-token` with its opaque session token. | Browser restarts become silent Drive restores rather than another Google connect prompt. |
| 8 | The Worker validates the session, decrypts the refresh token, asks Google for a short-lived access token, and returns it with `Cache-Control: no-store`. | The browser holds a Drive access token only in memory and the long-lived credential remains server-side. |

Google’s web-server OAuth flow supports requesting offline access and later exchanging a refresh token for access tokens.[1][2]

## Endpoint contract

| Method and path | Browser use | Result |
|---|---|---|
| `GET /auth/google/start` | One-time device connection. | Generates state and redirects to Google OAuth. |
| `GET /auth/google/callback` | Google-only callback. | Validates the OAuth result, stores the encrypted refresh token, creates a device session, redirects to GitHub Pages with a fragment token. |
| `POST /session/access-token` | Automatic on page load when a local session handle exists. | Returns a fresh short-lived Drive API access token. |
| `DELETE /session` | “Forget this device” action. | Invalidates only the current browser session. |
| `DELETE /connection` | “Disconnect Google Drive everywhere” action. | Revokes the Google grant where possible, deletes the encrypted token, and invalidates every device session. |
| `GET /health` | Deployment check only. | Returns version and dependency status, never user or token data. |

Every response containing authentication or token information will use `Cache-Control: no-store`, strict `Access-Control-Allow-Origin` matching only `https://bettercall-gautam.github.io`, and no wildcard CORS policy.

## D1 schema

```sql
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
```

`owner_key` is a fixed service-side identifier such as `primary`. It is not a user-facing ID. No file contents, vocabulary words, OpenRouter key, Google client secret, plain refresh token, or plain browser session token will be stored in D1.

## Required Cloudflare secrets and bindings

| Binding | Type | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Secret | Dedicated Google web OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Secret | Used only for the server-side authorization-code and refresh-token exchanges. |
| `TOKEN_ENCRYPTION_KEY` | Secret | Base64-encoded 256-bit AES-GCM key. |
| `OWNER_GOOGLE_EMAIL` | Secret | Rejects OAuth completion by any Google account other than the owner’s account. |
| `FRONTEND_ORIGIN` | Plain environment value | Exact allowed origin: `https://bettercall-gautam.github.io`. |
| `FRONTEND_RETURN_URL` | Plain environment value | Exact callback return location: `https://bettercall-gautam.github.io/vocab-sync/`. |
| `DB` | D1 binding | Encrypted connection and hashed browser-session records. |

Cloudflare secrets are encrypted and made available to a Worker as bindings; Workers provide Web Crypto primitives suitable for AES-GCM encryption.[3][4]

## Deliberate exclusions

The first release will not add a general account system, an app database for vocabulary, a MongoDB integration, a background scheduler, or a proxy for OpenRouter. Vocab remains authored and synchronized to the user’s Drive file as it does today. This keeps the backend surface area small and avoids storing unrelated personal data.

The opaque browser-session handle will be stored in local storage because GitHub Pages and a `workers.dev` Worker are different sites. Cross-site cookies may be blocked or partitioned by mobile browsers, which would recreate the exact persistence problem this work is meant to solve. The session handle is not a Google token, is random and revocable, is sent only over HTTPS to the exact Worker origin, and is never written to logs.

## Migration safeguards and acceptance checks

The existing browser-only Drive connection remains available until the Worker path has been validated. The implementation is accepted only when all of the following pass:

| Check | Expected outcome |
|---|---|
| Existing live app remains usable before migration. | No accidental regression to Capture, Library, Picker, or Drive sync. |
| First persistent connection | Correct owner account completes OAuth and receives a device session. |
| Wrong account attempt | Worker rejects it without replacing the saved connection. |
| Browser restart | App silently obtains a fresh Drive access token and restores the remembered Markdown file without a Connect Drive tap. |
| Second device | Device must connect once, then persists independently. |
| Session removal | “Forget this device” requires a new one-time Drive connection on that browser only. |
| Full disconnect | Refresh token and all browser sessions are removed; silent access stops on every device. |
| Secret audit | No Google client secret, refresh token, encryption key, or session token exists in the Git repository, GitHub Pages build output, or browser console. |

## Setup dependency

Before the Worker can be deployed, the owner must create a Cloudflare account and create or rotate a dedicated Google **Web application** OAuth client. The new client will register the Worker’s exact callback URL only after the Worker’s public URL is known. This ordering prevents guessed redirect URLs and avoids committing secrets into source control.

## References

[1] [Google, Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)

[2] [Google, Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)

[3] [Cloudflare, Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

[4] [Cloudflare, Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

[5] [Cloudflare, D1](https://developers.cloudflare.com/d1/)
