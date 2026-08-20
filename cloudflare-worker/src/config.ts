export type Env = {
  DB: D1Database;
  FRONTEND_ORIGIN: string;
  FRONTEND_RETURN_URL: string;
  WORKER_ORIGIN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  OWNER_GOOGLE_EMAIL: string;
};

export type RuntimeConfig = {
  frontendOrigin: string;
  frontendReturnUrl: string;
  workerOrigin: string;
  ownerGoogleEmail: string;
};

const canonicalOrigin = (value: string, name: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS.`);
  }

  return url.origin;
};

export const getRuntimeConfig = (env: Env): RuntimeConfig => {
  const frontendOrigin = canonicalOrigin(env.FRONTEND_ORIGIN, "FRONTEND_ORIGIN");
  const workerOrigin = canonicalOrigin(env.WORKER_ORIGIN, "WORKER_ORIGIN");
  const frontendReturnUrl = new URL(env.FRONTEND_RETURN_URL);

  if (frontendReturnUrl.origin !== frontendOrigin) {
    throw new Error("FRONTEND_RETURN_URL must belong to FRONTEND_ORIGIN.");
  }

  const ownerGoogleEmail = env.OWNER_GOOGLE_EMAIL?.trim().toLowerCase();
  if (!ownerGoogleEmail || !ownerGoogleEmail.includes("@")) {
    throw new Error("OWNER_GOOGLE_EMAIL must be a valid email address.");
  }

  return {
    frontendOrigin,
    frontendReturnUrl: frontendReturnUrl.toString(),
    workerOrigin,
    ownerGoogleEmail,
  };
};
