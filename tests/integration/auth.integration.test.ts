import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import type { PrismaClient } from "@/generated/prisma/client";
import { AuthError } from "@/server/auth/errors";
import { createAuthService } from "@/server/auth/service";
import { hashSessionToken } from "@/server/auth/session";
import {
  createAuthTestClient,
  prepareAuthTestDatabase,
} from "./auth-test-database";

const SESSION_SECRET = "integration-test-session-secret-".padEnd(64, "s");
const logger = { warn: vi.fn() };
let database: PrismaClient;

function service(options: { maximumFailures?: number } = {}) {
  const maximumFailures = options.maximumFailures ?? 5;
  return createAuthService({
    database,
    sessionSecret: SESSION_SECRET,
    logger,
    rateLimits: {
      registration: { maximumFailures, windowMs: 60_000, blockMs: 60_000 },
      login: { maximumFailures, windowMs: 60_000, blockMs: 60_000 },
      passwordChange: { maximumFailures, windowMs: 60_000, blockMs: 60_000 },
    },
  });
}

const registration = {
  login: "  Test.User  ",
  displayName: "Тестовый пользователь",
  password: "correct horse battery staple",
  repeatPassword: "correct horse battery staple",
};

beforeAll(async () => {
  await prepareAuthTestDatabase();
  database = createAuthTestClient();
});

beforeEach(async () => {
  logger.warn.mockClear();
  await database.authAttempt.deleteMany();
  await database.session.deleteMany();
  await database.notificationPreference.deleteMany();
  await database.onboardingState.deleteMany();
  await database.userSettings.deleteMany();
  await database.user.deleteMany();
});

afterAll(async () => {
  await database.$disconnect();
});

describe("server-only authentication", () => {
  it("registers normalized unique login, hashes the password and stores only token hash", async () => {
    const result = await service().register(registration, {
      networkIdentifier: "127.0.0.1",
      currentSessionToken: "Z".repeat(43),
    });
    const user = await database.user.findUniqueOrThrow({
      where: { id: result.user.id },
      include: { settings: true, onboardingState: true, notification: true },
    });
    const session = await database.session.findFirstOrThrow({
      where: { userId: user.id },
    });

    expect(user.loginNormalized).toBe("test.user");
    expect(user.displayName).toBe(registration.displayName);
    expect(user.baseCurrency).toBe("RUB");
    expect(user.passwordHash).toMatch(/^\$argon2id\$/u);
    expect(user.passwordHash).not.toContain(registration.password);
    expect(user.settings).not.toBeNull();
    expect(user.onboardingState).not.toBeNull();
    expect(user.onboardingState?.completedAt).toBeNull();
    expect(user.notification).not.toBeNull();
    expect(session.tokenHash).toBe(
      hashSessionToken(result.session.rawToken, SESSION_SECRET),
    );
    expect(JSON.stringify(session)).not.toContain(result.session.rawToken);
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("returns the same external credential error for unknown login and wrong password", async () => {
    await service().register(registration);
    const auth = service();
    await expect(
      auth.login({ login: "unknown", password: "wrong password" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Неверный логин или пароль.",
    });
    await expect(
      auth.login({ login: "test.user", password: "wrong password" }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "Неверный логин или пароль.",
    });
  });

  it("prevents duplicate normalized registration without exposing account existence", async () => {
    const auth = service();
    await auth.register(registration);
    await expect(
      auth.register({ ...registration, login: "TEST.USER" }),
    ).rejects.toMatchObject({
      code: "REGISTRATION_FAILED",
    });
  });

  it("rotates an existing session on login and authenticates only the new token", async () => {
    const auth = service();
    const registered = await auth.register(registration);
    const loggedIn = await auth.login(
      { login: "test.user", password: registration.password },
      { currentSessionToken: registered.session.rawToken },
    );

    expect(loggedIn.session.rawToken).not.toBe(registered.session.rawToken);
    await expect(
      auth.authenticate(registered.session.rawToken),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      auth.authenticate(loggedIn.session.rawToken),
    ).resolves.toMatchObject({
      id: registered.user.id,
    });
  });

  it("does not let a malformed prior cookie block a successful login", async () => {
    const auth = service();
    const registered = await auth.register(registration);

    await expect(
      auth.login(
        { login: "test.user", password: registration.password },
        { currentSessionToken: "malformed-cookie-value" },
      ),
    ).resolves.toMatchObject({ user: { id: registered.user.id } });
  });

  it("revokes the persisted session on logout", async () => {
    const auth = service();
    const registered = await auth.register(registration);
    await auth.logout(registered.session.rawToken);

    await expect(
      auth.authenticate(registered.session.rawToken),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("treats a malformed logout cookie as already unauthenticated", async () => {
    await expect(
      service().logout("malformed-cookie-value"),
    ).resolves.toBeUndefined();
  });

  it("changes password only after current verification and rotates every active session", async () => {
    const auth = service();
    const first = await auth.register(registration);
    const second = await auth.login({
      login: "test.user",
      password: registration.password,
    });

    await expect(
      auth.changePassword(first.session.rawToken, {
        currentPassword: "incorrect current password",
        newPassword: "a completely new password",
        repeatPassword: "a completely new password",
      }),
    ).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INVALID" });

    const changed = await auth.changePassword(first.session.rawToken, {
      currentPassword: registration.password,
      newPassword: "a completely new password",
      repeatPassword: "a completely new password",
    });
    await expect(
      auth.authenticate(first.session.rawToken),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      auth.authenticate(second.session.rawToken),
    ).rejects.toBeInstanceOf(AuthError);
    await expect(
      auth.authenticate(changed.session.rawToken),
    ).resolves.toMatchObject({ id: first.user.id });
    await expect(
      auth.login({ login: "test.user", password: registration.password }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      auth.login({ login: "test.user", password: "a completely new password" }),
    ).resolves.toBeDefined();
  });

  it("enforces registration and login limits from persisted attempts", async () => {
    const auth = service({ maximumFailures: 1 });
    await expect(
      auth.login(
        { login: "unknown", password: "wrong password" },
        { networkIdentifier: "10.0.0.5" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      auth.login(
        { login: "unknown", password: "wrong password" },
        { networkIdentifier: "10.0.0.5" },
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });

    await auth.register(registration);
    await expect(
      auth.register({ ...registration, login: "test.user" }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("enforces password-change limit by the authenticated server-side user", async () => {
    const auth = service({ maximumFailures: 1 });
    const registered = await auth.register(registration);
    const invalidChange = {
      currentPassword: "incorrect current password",
      newPassword: "a completely new password",
      repeatPassword: "a completely new password",
      userId: "attacker-controlled",
    };
    await expect(
      auth.changePassword(registered.session.rawToken, invalidChange),
    ).rejects.toMatchObject({
      code: "CURRENT_PASSWORD_INVALID",
    });
    await expect(
      auth.changePassword(registered.session.rawToken, invalidChange),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
