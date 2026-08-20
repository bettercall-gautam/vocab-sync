import type { RuntimeConfig } from "./config";

export const GOOGLE_DRIVE_SCOPE = "openid email https://www.googleapis.com/auth/drive.file";

export const buildGoogleAuthorizationUrl = (
  googleClientId: string,
  config: RuntimeConfig,
  state: string,
): string => {
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", googleClientId);
  authorizationUrl.searchParams.set("redirect_uri", `${config.workerOrigin}/auth/google/callback`);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", GOOGLE_DRIVE_SCOPE);
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "consent");
  authorizationUrl.searchParams.set("state", state);
  return authorizationUrl.toString();
};
