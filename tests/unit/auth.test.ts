import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizeLogin } from "@/lib/auth/login";
import {
  changePasswordInputSchema,
  loginInputSchema,
  registrationInputSchema,
} from "@/lib/auth/validation";
import { SameOriginError, assertSameOrigin } from "@/server/auth/same-origin";
import { authLogger } from "@/server/auth/logger";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionGrant,
  createSessionToken,
  getSessionCookieOptions,
  hashSessionToken,
} from "@/server/auth/session";
import { getTrustedNetworkIdentifier } from "@/server/auth/trusted-proxy";

describe("login normalization", () => {
  it("normalizes Unicode compatibility forms, whitespace and case", () => {
    expect(normalizeLogin("  ＫОПИЛКА.User  ")).toBe("kопилка.user");
  });

  it("rejects invisible, unsupported and oversized login values", () => {
    expect(() => normalizeLogin("ab")).toThrow();
    expect(() => normalizeLogin("user name")).toThrow();
    expect(() => normalizeLogin("user@example.com")).toThrow();
    expect(() => normalizeLogin("a".repeat(65))).toThrow();
  });
});

describe("auth validation", () => {
  it("accepts a valid registration and strips unknown fields", () => {
    const result = registrationInputSchema.parse({
      login: "user.name",
      displayName: "  Алексей  ",
      password: "correct horse battery staple",
      repeatPassword: "correct horse battery staple",
      userId: "attacker-controlled",
    });

    expect(result).toEqual({
      login: "user.name",
      displayName: "Алексей",
      password: "correct horse battery staple",
      repeatPassword: "correct horse battery staple",
    });
    expect(result).not.toHaveProperty("userId");
  });

  it("rejects mismatched, short and excessively large passwords", () => {
    const base = {
      login: "valid-user",
      displayName: "Алексей",
      repeatPassword: "different password",
    };

    expect(() =>
      registrationInputSchema.parse({ ...base, password: "short" }),
    ).toThrow();
    expect(() =>
      registrationInputSchema.parse({
        ...base,
        password: "a".repeat(129),
        repeatPassword: "a".repeat(129),
      }),
    ).toThrow();
  });

  it("requires a non-empty display name", () => {
    expect(() =>
      registrationInputSchema.parse({
        login: "valid-user",
        displayName: "   ",
        password: "correct horse battery staple",
        repeatPassword: "correct horse battery staple",
      }),
    ).toThrow();
  });

  it("validates login and password-change boundaries", () => {
    expect(
      loginInputSchema.parse({ login: "valid-user", password: "not-empty" }),
    ).toEqual({ login: "valid-user", password: "not-empty" });

    expect(() =>
      changePasswordInputSchema.parse({
        currentPassword: "current password",
        newPassword: "new secure password",
        repeatPassword: "different secure password",
      }),
    ).toThrow();
  });
});

describe("session security", () => {
  const secret = "s".repeat(64);

  it("generates unpredictable URL-safe tokens with enough entropy", () => {
    const tokens = new Set(
      Array.from({ length: 128 }, () => createSessionToken()),
    );

    expect(tokens.size).toBe(128);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    }
  });

  it("stores only a deterministic HMAC hash and sets a bounded expiry", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const grant = createSessionGrant(secret, now, () => "A".repeat(43));

    expect(grant.rawToken).toBe("A".repeat(43));
    expect(grant.tokenHash).toBe(hashSessionToken(grant.rawToken, secret));
    expect(grant.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(grant.tokenHash).not.toContain(grant.rawToken);
    expect(grant.expiresAt.getTime() - now.getTime()).toBe(SESSION_TTL_MS);
  });

  it("uses hardened cookies and enables Secure only in production", () => {
    expect(SESSION_COOKIE_NAME).toBe("kopilka_session");
    expect(getSessionCookieOptions("development")).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(getSessionCookieOptions("production").secure).toBe(true);
  });
});

describe("same-origin protection", () => {
  it("accepts only the configured application origin", () => {
    const headers = new Headers({
      origin: "https://kopilka.example",
      "sec-fetch-site": "same-origin",
    });

    expect(() =>
      assertSameOrigin(headers, "https://kopilka.example"),
    ).not.toThrow();
  });

  it("accepts equivalent loopback hostnames on the configured development port", () => {
    const headers = new Headers({
      origin: "http://127.0.0.1:3000",
      "sec-fetch-site": "same-origin",
    });

    expect(() =>
      assertSameOrigin(headers, "http://localhost:3000"),
    ).not.toThrow();
  });

  it.each([
    new Headers(),
    new Headers({
      origin: "https://evil.example",
      "sec-fetch-site": "cross-site",
    }),
    new Headers({
      origin: "http://127.0.0.1:3001",
      "sec-fetch-site": "same-origin",
    }),
    new Headers({ origin: "null", "sec-fetch-site": "cross-site" }),
  ])("rejects missing or cross-origin mutation metadata", (headers) => {
    expect(() => assertSameOrigin(headers, "https://kopilka.example")).toThrow(
      SameOriginError,
    );
  });
});

describe("trusted proxy network metadata", () => {
  it("ignores client-controlled forwarding headers unless a trusted proxy is enabled", () => {
    const headers = new Headers({
      "x-real-ip": "198.51.100.17",
      "x-forwarded-for": "198.51.100.18, 10.0.0.2",
    });

    expect(getTrustedNetworkIdentifier(headers, false)).toBeUndefined();
    expect(getTrustedNetworkIdentifier(headers, true)).toBe("198.51.100.17");
  });

  it("uses a validated first forwarded address only in trusted-proxy mode", () => {
    expect(
      getTrustedNetworkIdentifier(
        new Headers({ "x-forwarded-for": "2001:db8::1, 10.0.0.2" }),
        true,
      ),
    ).toBe("2001:db8::1");
    expect(
      getTrustedNetworkIdentifier(
        new Headers({ "x-forwarded-for": "spoofed-value" }),
        true,
      ),
    ).toBeUndefined();
  });
});

describe("safe auth logging", () => {
  it("whitelists metadata and never serializes passwords or tokens", () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    authLogger.warn("login_failed", {
      requestId: "request-1",
      password: "must-not-appear",
      token: "must-not-appear",
    } as never);

    expect(consoleWarn).toHaveBeenCalledWith(
      JSON.stringify({
        scope: "auth",
        event: "login_failed",
        requestId: "request-1",
      }),
    );
    consoleWarn.mockRestore();
  });
});
