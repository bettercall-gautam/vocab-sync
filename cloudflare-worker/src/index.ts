import { randomBase64Url } from "./base64";
import { getRuntimeConfig, type Env, type RuntimeConfig } from "./config";
import { decryptText, encryptText, importEncryptionKey, sha256Base64Url } from "./crypto";
import {
  createBrowserSession,
  deleteConnectionAndSessions,
  getActiveBrowserSession,
  getDriveConnection,
  revokeBrowserSession,
  saveDriveConnection,
} from "./database";
import { buildGoogleAuthorizationUrl, GOOGLE_DRIVE_SCOPE } from "./oauth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const OAUTH_STATE_COOKIE = "vocab_sync_oauth_state";
const BROWSER_SESSION_HEADER = "x-vocab-sync-session";
const DEVICE_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 90;
const TOKEN_AAD = "vocab-sync:primary:refresh-token:v1";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
};

const parseCookies = (request: Request): Map<string, string> => {
  const cookies = new Map<string, string>();
  const header = request.headers.get("Cookie");
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name) cookies.set(name, value.join("="));
  }

  return cookies;
};

const jsonResponse = (body: unknown, init: ResponseInit = {}, corsHeaders?: Headers): Response => {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  corsHeaders?.forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { ...init, headers });
};

const errorResponse = (status: number, code: string, corsHeaders?: Headers): Response =>
  jsonResponse({ error: code }, { status }, corsHeaders);

const exactCorsHeaders = (request: Request, config: RuntimeConfig): Headers | null => {
  const origin = request.headers.get("Origin");
  if (origin !== config.frontendOrigin) return null;

  return new Headers({
    "Access-Control-Allow-Origin": config.frontendOrigin,
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": `Content-Type, ${BROWSER_SESSION_HEADER}`,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  });
};

const oauthStateCookie = (state: string): string =>
  `${OAUTH_STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/auth/google/callback; Max-Age=600`;

const clearOauthStateCookie = (): string =>
  `${OAUTH_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/auth/google/callback; Max-Age=0`;

const requestGoogleToken = async (body: URLSearchParams): Promise<GoogleTokenResponse> => {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const result = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !result.access_token) {
    throw new Error(result.error === "invalid_grant" ? "google_refresh_invalid" : "google_token_exchange_failed");
  }

  return result;
};

const loadGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo> => {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error("google_userinfo_failed");
  return response.json<GoogleUserInfo>();
};

const getCallbackUrl = (config: RuntimeConfig): string => `${config.workerOrigin}/auth/google/callback`;

const ensureWorkerOrigin = (request: Request, config: RuntimeConfig): boolean =>
  new URL(request.url).origin === config.workerOrigin;

const startGoogleOAuth = (env: Env, config: RuntimeConfig): Response => {
  const state = randomBase64Url();
  const authorizationUrl = buildGoogleAuthorizationUrl(env.GOOGLE_CLIENT_ID, config, state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizationUrl,
      "Set-Cookie": oauthStateCookie(state),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
};

const completeGoogleOAuth = async (request: Request, env: Env, config: RuntimeConfig): Promise<Response> => {
  const url = new URL(request.url);
  const expectedState = parseCookies(request).get(OAUTH_STATE_COOKIE);
  const receivedState = url.searchParams.get("state");
  const authorizationCode = url.searchParams.get("code");

  if (!expectedState || !receivedState || expectedState !== receivedState || !authorizationCode) {
    return errorResponse(400, "invalid_oauth_callback");
  }

  try {
    const token = await requestGoogleToken(
      new URLSearchParams({
        code: authorizationCode,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: getCallbackUrl(config),
        grant_type: "authorization_code",
      }),
    );

    if (!token.refresh_token) return errorResponse(400, "missing_offline_access");

    const userInfo = await loadGoogleUserInfo(token.access_token!);
    const email = userInfo.email?.trim().toLowerCase();
    if (!userInfo.sub || !email || !userInfo.email_verified || email !== config.ownerGoogleEmail) {
      return errorResponse(403, "google_account_not_allowed");
    }

    const encryptionKey = await importEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
    const encryptedRefreshToken = await encryptText(token.refresh_token, encryptionKey, TOKEN_AAD);
    await saveDriveConnection(env.DB, {
      google_subject: userInfo.sub,
      owner_email: email,
      encrypted_refresh_token: encryptedRefreshToken.ciphertext,
      refresh_token_iv: encryptedRefreshToken.iv,
      granted_scopes: token.scope ?? GOOGLE_DRIVE_SCOPE,
      key_version: 1,
    });

    const browserSession = randomBase64Url();
    await createBrowserSession(env.DB, await sha256Base64Url(browserSession), Date.now() + DEVICE_SESSION_TTL_MS);

    const returnUrl = new URL(config.frontendReturnUrl);
    returnUrl.hash = new URLSearchParams({ drive_session: browserSession }).toString();
    const headers = new Headers({
      Location: returnUrl.toString(),
      "Set-Cookie": clearOauthStateCookie(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "oauth_connection_failed";
    return errorResponse(code === "google_refresh_invalid" ? 401 : 500, code);
  }
};

const getSessionHash = async (request: Request): Promise<string | null> => {
  const session = request.headers.get(BROWSER_SESSION_HEADER);
  return session ? sha256Base64Url(session) : null;
};

const requireSession = async (request: Request, env: Env, corsHeaders: Headers): Promise<string | Response> => {
  const sessionHash = await getSessionHash(request);
  if (!sessionHash || !(await getActiveBrowserSession(env.DB, sessionHash))) {
    return errorResponse(401, "device_session_required", corsHeaders);
  }
  return sessionHash;
};

const createAccessTokenResponse = async (request: Request, env: Env, corsHeaders: Headers): Promise<Response> => {
  const sessionHash = await requireSession(request, env, corsHeaders);
  if (sessionHash instanceof Response) return sessionHash;

  const connection = await getDriveConnection(env.DB);
  if (!connection) return errorResponse(401, "drive_connection_required", corsHeaders);

  try {
    const encryptionKey = await importEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
    const refreshToken = await decryptText(
      { ciphertext: connection.encrypted_refresh_token, iv: connection.refresh_token_iv },
      encryptionKey,
      TOKEN_AAD,
    );
    const token = await requestGoogleToken(
      new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    );

    return jsonResponse(
      {
        accessToken: token.access_token,
        expiresInSeconds: token.expires_in ?? 3600,
        scope: token.scope ?? connection.granted_scopes,
      },
      { status: 200 },
      corsHeaders,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "google_refresh_invalid") {
      await deleteConnectionAndSessions(env.DB);
      return errorResponse(401, "drive_reauthorization_required", corsHeaders);
    }
    return errorResponse(500, "token_refresh_failed", corsHeaders);
  }
};

const forgetCurrentDevice = async (request: Request, env: Env, corsHeaders: Headers): Promise<Response> => {
  const sessionHash = await requireSession(request, env, corsHeaders);
  if (sessionHash instanceof Response) return sessionHash;
  await revokeBrowserSession(env.DB, sessionHash);
  return new Response(null, { status: 204, headers: corsHeaders });
};

const disconnectEverywhere = async (request: Request, env: Env, corsHeaders: Headers): Promise<Response> => {
  const sessionHash = await requireSession(request, env, corsHeaders);
  if (sessionHash instanceof Response) return sessionHash;

  const connection = await getDriveConnection(env.DB);
  if (connection) {
    try {
      const encryptionKey = await importEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
      const refreshToken = await decryptText(
        { ciphertext: connection.encrypted_refresh_token, iv: connection.refresh_token_iv },
        encryptionKey,
        TOKEN_AAD,
      );
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
    } catch {
      // Local deletion remains the security priority even if Google revocation is unavailable.
    }
  }

  await deleteConnectionAndSessions(env.DB);
  return new Response(null, { status: 204, headers: corsHeaders });
};

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ status: "ok" });
    }

    let config: RuntimeConfig;
    try {
      config = getRuntimeConfig(env);
    } catch {
      return errorResponse(500, "worker_configuration_invalid");
    }

    if (!ensureWorkerOrigin(request, config)) return errorResponse(404, "not_found");

    if (request.method === "GET" && url.pathname === "/auth/google/start") {
      return startGoogleOAuth(env, config);
    }

    if (request.method === "GET" && url.pathname === "/auth/google/callback") {
      return completeGoogleOAuth(request, env, config);
    }

    const corsHeaders = exactCorsHeaders(request, config);
    if (!corsHeaders) return errorResponse(403, "origin_not_allowed");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (request.method === "POST" && url.pathname === "/session/access-token") {
      return createAccessTokenResponse(request, env, corsHeaders);
    }

    if (request.method === "DELETE" && url.pathname === "/session") {
      return forgetCurrentDevice(request, env, corsHeaders);
    }

    if (request.method === "DELETE" && url.pathname === "/connection") {
      return disconnectEverywhere(request, env, corsHeaders);
    }

    return errorResponse(404, "not_found", corsHeaders);
  },
} satisfies ExportedHandler<Env>;
