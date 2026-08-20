# Cloudflare Persistent Drive Backend Status

**Updated:** 20 August 2026

## Completed free-tier infrastructure

| Resource | Status | Notes |
|---|---|---|
| Cloudflare account | Ready | Created on the free plan. No billing information or paid plan was used. |
| D1 database | Ready | `vocab-sync-oauth` is initialized with the encrypted Drive connection and hashed device-session tables. |
| Worker | Live | `https://vocab-sync-drive-auth.gautamjaizz007.workers.dev` responds successfully at `/health`. |
| Worker bindings | Ready | The live Worker has only the D1 binding and three non-secret origin settings. |
| Google Cloud Console | Signed in | The existing `Vocab Sync` Google Cloud project is accessible. |
| Local validation | Passed | The full Vitest suite passed 30 tests, and the Worker TypeScript project passed a no-emit type check. |

## Still required

The Worker needs a dedicated Google OAuth **Web application** credential with this exact authorized redirect URI:

```text
https://vocab-sync-drive-auth.gautamjaizz007.workers.dev/auth/google/callback
```

Once created, the Google client ID, Google client secret, a random AES-GCM encryption key, and the approved owner email must be stored as Cloudflare Worker secrets. They must never be committed to this public repository, inserted into GitHub Pages build variables, or placed in browser storage.

## Current console-automation limitation

The Google Cloud project was successfully reached after the owner signed in through the sandbox browser. The Google Cloud Console browser bridge then replaced the active OAuth-client form with `about:blank` immediately after a dynamic form action. This happened twice through different form-navigation paths, so automated entry is paused rather than repeatedly retrying a fragile browser session.

The safe fallback is a short owner-assisted configuration in Google Cloud Console. The exact client type, name, redirect URI, and secret-storage requirements remain documented in the persistent Drive design and this status file. No credential value was created, viewed, copied, or stored during the failed browser actions.
