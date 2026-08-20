# Persistent Google Drive Session Options

## Verified constraint

The current static Vocab Sync app uses Google’s browser token flow. It receives a short-lived access token, which ends when the browser session closes. A browser-only app can remember local interface state, but it cannot securely retain a refresh credential that renews Drive access after restart.

Google documents that a client-side JavaScript application receives an access token and must repeat that process after expiry. Google’s web-server OAuth flow is the supported model for receiving an authorization code, exchanging it for access and refresh tokens, and renewing access when the user is no longer at the browser.[1][2]

## What a fully persistent solution requires

The persistent design needs a server-side component with all of the following responsibilities:

| Responsibility | Required behavior |
|---|---|
| OAuth callback | Receive Google’s authorization code at an exact registered HTTPS redirect URI. |
| Client secret | Keep the web OAuth client secret in server-only configuration, never in browser code or GitHub. |
| Refresh-token storage | Encrypt the refresh token at rest and associate it with the single owner account. |
| Session protection | Use an HTTP-only, secure session cookie and anti-CSRF state validation. |
| Renewal | Exchange the refresh token for a short-lived access token only when Drive work is requested. |
| Failure handling | If Google revokes or expires the refresh token, return the user to the consent flow without losing local drafts. |

Google recommends `access_type=offline` for a web-server application that must refresh access without the user present. It also notes that refresh tokens need secure long-term storage and can later stop working due to revocation, inactivity, token limits, or testing-mode expiry.[1][2]

## Decision implications

This is feasible with the existing full-stack project template, but it cannot remain a GitHub Pages-only static deployment. It needs a secure server deployment and a new Google **Web application** OAuth client with an authorized callback URL. The current browser client should remain for the static mode or be retired after a careful migration.

## Current provider comparison

| Option | What it provides | Fit for one owner | Important tradeoff |
|---|---|---|---|
| **Cloudflare Worker plus D1** | A lightweight HTTPS callback, encrypted Worker secrets, a small serverless SQL record, and Web Crypto support for application-level token encryption. | **Recommended.** The free allowance is vastly above this app’s expected volume, and the backend is limited to one small OAuth responsibility. | A separate Cloudflare account and deployment are required. The GitHub Pages frontend will call a Worker endpoint. |
| **Supabase Edge Function plus Postgres** | TypeScript edge functions, project secrets, Postgres, and optional user auth in one account. | Technically strong and familiar because the owner already has an account. | Free projects pause after one week of inactivity, so the first return after a break may be slow or require project wake up. It is less reliable for an app intended to open any day without friction. |
| **MongoDB Atlas plus separate function host** | A document database. | Works, but not recommended. | Atlas is only the database. A second service is still needed for the OAuth callback, secrets, encryption, and API endpoint. That adds moving parts without helping this single-token use case. |
| **Keep static browser-only mode** | No server, no token storage, and lowest maintenance. | Still the safest zero-configuration path. | It cannot silently refresh Drive access after a browser restart. |

Cloudflare’s current free Workers plan includes 100,000 requests per day, while D1 is available on the free plan with 5 GB of storage. Worker secrets are encrypted bindings and Cloudflare Workers support Web Crypto, including AES-GCM encryption and decryption. Those capabilities are sufficient for this owner-only OAuth token keeper at the intended usage level.[3][4][5]

## Recommended minimal architecture

```text
GitHub Pages Vocab Sync
        |
        | HTTPS requests with strict origin checks
        v
Cloudflare Worker
  1. Starts Google web-server OAuth flow
  2. Validates state and callback
  3. Encrypts refresh token with AES-GCM
  4. Stores ciphertext and metadata in one D1 row
  5. Uses refresh token to obtain short access tokens on demand
        |
        v
Google Drive API
```

The Worker keeps the Google client secret and encryption key as platform secrets. D1 stores only the encrypted refresh-token ciphertext, initialization vector, owner identifier, granted scope, and timestamps. The browser receives a secure, HTTP-only session cookie, not a Google refresh token.

## Sources

[1] [Google, Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)

[2] [Google, Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)

[3] [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

[4] [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

[5] [Cloudflare D1 Overview](https://developers.cloudflare.com/d1/)

[6] [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)

[7] [Supabase Pricing](https://supabase.com/pricing)

[8] [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## Sources

[1] [Google, Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)

[2] [Google, Using OAuth 2.0 to Access Google APIs](https://developers.google.com/identity/protocols/oauth2)
