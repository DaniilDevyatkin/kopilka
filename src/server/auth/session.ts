import "server-only";

import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "kopilka_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export interface SessionGrant {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isSessionToken(value: string): boolean {
  return SESSION_TOKEN_PATTERN.test(value);
}

export function hashSessionToken(
  rawToken: string,
  sessionSecret: string,
): string {
  if (rawToken.length < 32 || sessionSecret.length < 64) {
    throw new Error("Session security configuration is invalid.");
  }

  return createHmac("sha256", sessionSecret)
    .update(rawToken, "utf8")
    .digest("hex");
}

export function createSessionGrant(
  sessionSecret: string,
  now: Date = new Date(),
  tokenFactory: () => string = createSessionToken,
): SessionGrant {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Session clock is invalid.");
  }

  const rawToken = tokenFactory();
  return {
    rawToken,
    tokenHash: hashSessionToken(rawToken, sessionSecret),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  };
}

export function getSessionCookieOptions(
  nodeEnvironment: string | undefined,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnvironment === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
