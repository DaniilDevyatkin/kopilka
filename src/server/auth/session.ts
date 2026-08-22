import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import {
  isSessionToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session-token";

export { isSessionToken, SESSION_COOKIE_NAME };

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
