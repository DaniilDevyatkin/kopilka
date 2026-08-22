import "server-only";

import { createHmac } from "node:crypto";

import { AuthAttemptAction, Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeLogin } from "@/lib/auth/login";
import {
  changePasswordInputSchema,
  loginInputSchema,
  registrationInputSchema,
} from "@/lib/auth/validation";
import { AuthError } from "@/server/auth/errors";
import type { AuthLogger } from "@/server/auth/logger";
import {
  hashPassword,
  verifyPasswordWithoutEnumeration,
} from "@/server/auth/password";
import {
  createSessionGrant,
  hashSessionToken,
  isSessionToken,
  type SessionGrant,
} from "@/server/auth/session";

type AuthDatabase = PrismaClient | Prisma.TransactionClient;

export interface AuthenticatedUser {
  id: string;
  displayName: string | null;
  baseCurrency: "RUB" | "EUR" | "USD" | "KZT" | "GEL";
  onboardingCompleted: boolean;
}

export interface AuthenticatedResult {
  user: AuthenticatedUser;
  session: SessionGrant;
}

interface RateLimitRule {
  maximumFailures: number;
  windowMs: number;
  blockMs: number;
}

export interface AuthRateLimits {
  registration: RateLimitRule;
  login: RateLimitRule;
  passwordChange: RateLimitRule;
}

const DEFAULT_RATE_LIMITS: AuthRateLimits = {
  registration: {
    maximumFailures: 5,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  },
  login: { maximumFailures: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  passwordChange: {
    maximumFailures: 5,
    windowMs: 15 * 60_000,
    blockMs: 15 * 60_000,
  },
};

interface AuthServiceDependencies {
  database: PrismaClient;
  sessionSecret: string;
  logger: AuthLogger;
  now?: () => Date;
  tokenFactory?: () => string;
  rateLimits?: Partial<AuthRateLimits>;
}

interface RequestContext {
  networkIdentifier?: string | undefined;
  currentSessionToken?: string | undefined;
  requestId?: string | undefined;
}

function hashRateLimitSubject(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`rate-limit:${value}`)
    .digest("hex");
}

function publicUser(user: {
  id: string;
  displayName: string | null;
  baseCurrency: AuthenticatedUser["baseCurrency"];
  onboardingState?: { completedAt: Date | null } | null;
}): AuthenticatedUser {
  return {
    id: user.id,
    displayName: user.displayName,
    baseCurrency: user.baseCurrency,
    onboardingCompleted: Boolean(user.onboardingState?.completedAt),
  };
}

export function createAuthService(dependencies: AuthServiceDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const limits = { ...DEFAULT_RATE_LIMITS, ...dependencies.rateLimits };

  function subjectHash(value: string): string {
    return hashRateLimitSubject(value, dependencies.sessionSecret);
  }

  function networkHash(context: RequestContext): string | null {
    return context.networkIdentifier
      ? subjectHash(`network:${context.networkIdentifier}`)
      : null;
  }

  function logMetadata(context: RequestContext): { requestId?: string } {
    return context.requestId ? { requestId: context.requestId } : {};
  }

  async function assertRateLimit(
    database: AuthDatabase,
    action: AuthAttemptAction,
    subject: string,
    context: RequestContext,
    rule: RateLimitRule,
  ): Promise<void> {
    const currentTime = now();
    const subjectDigest = subjectHash(subject);
    const networkDigest = networkHash(context);
    const activeBlock = await database.authAttempt.findFirst({
      where: {
        action,
        blockedUntil: { gt: currentTime },
        OR: [
          { subjectHash: subjectDigest },
          ...(networkDigest ? [{ networkHash: networkDigest }] : []),
        ],
      },
      select: { id: true },
    });
    if (activeBlock) throw new AuthError("RATE_LIMITED");

    const occurredAt = new Date(currentTime.getTime() - rule.windowMs);
    const outcomeFilter =
      action === AuthAttemptAction.REGISTRATION ? {} : { succeeded: false };
    const [subjectFailures, networkFailures] = await Promise.all([
      database.authAttempt.count({
        where: {
          action,
          subjectHash: subjectDigest,
          ...outcomeFilter,
          occurredAt: { gte: occurredAt },
        },
      }),
      networkDigest
        ? database.authAttempt.count({
            where: {
              action,
              networkHash: networkDigest,
              ...outcomeFilter,
              occurredAt: { gte: occurredAt },
            },
          })
        : Promise.resolve(0),
    ]);

    if (
      subjectFailures >= rule.maximumFailures ||
      networkFailures >= rule.maximumFailures
    ) {
      await database.authAttempt.create({
        data: {
          action,
          subjectHash: subjectDigest,
          networkHash: networkDigest,
          blockedUntil: new Date(currentTime.getTime() + rule.blockMs),
          occurredAt: currentTime,
        },
      });
      dependencies.logger.warn("rate_limited", logMetadata(context));
      throw new AuthError("RATE_LIMITED");
    }
  }

  async function recordAttempt(
    database: AuthDatabase,
    action: AuthAttemptAction,
    subject: string,
    context: RequestContext,
    succeeded: boolean,
    userId?: string,
  ): Promise<void> {
    await database.authAttempt.create({
      data: {
        action,
        subjectHash: subjectHash(subject),
        networkHash: networkHash(context),
        succeeded,
        ...(userId ? { userId } : {}),
        occurredAt: now(),
      },
    });
  }

  async function createDatabaseSession(
    database: AuthDatabase,
    userId: string,
  ): Promise<SessionGrant> {
    const grant = createSessionGrant(
      dependencies.sessionSecret,
      now(),
      dependencies.tokenFactory,
    );
    await database.session.create({
      data: {
        userId,
        tokenHash: grant.tokenHash,
        expiresAt: grant.expiresAt,
        createdAt: now(),
        lastSeenAt: now(),
      },
    });
    return grant;
  }

  async function revokeToken(
    database: AuthDatabase,
    rawToken?: string,
  ): Promise<void> {
    if (!rawToken || !isSessionToken(rawToken)) return;
    await database.session.updateMany({
      where: {
        tokenHash: hashSessionToken(rawToken, dependencies.sessionSecret),
        revokedAt: null,
      },
      data: { revokedAt: now() },
    });
  }

  async function authenticate(
    rawToken: string | undefined,
  ): Promise<AuthenticatedUser> {
    if (!rawToken || !isSessionToken(rawToken)) {
      throw new AuthError("UNAUTHENTICATED");
    }
    const session = await dependencies.database.session.findUnique({
      where: {
        tokenHash: hashSessionToken(rawToken, dependencies.sessionSecret),
      },
      include: {
        user: {
          include: { onboardingState: { select: { completedAt: true } } },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now() ||
      session.user.disabledAt
    ) {
      throw new AuthError("UNAUTHENTICATED");
    }
    await dependencies.database.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now() },
    });
    return publicUser(session.user);
  }

  return {
    async register(
      input: unknown,
      context: RequestContext = {},
    ): Promise<AuthenticatedResult> {
      const parsed = registrationInputSchema.safeParse(input);
      if (!parsed.success) throw new AuthError("INVALID_INPUT");

      let loginNormalized: string;
      try {
        loginNormalized = normalizeLogin(parsed.data.login);
      } catch {
        throw new AuthError("INVALID_INPUT");
      }
      const rateSubject = `registration:${loginNormalized}`;
      await assertRateLimit(
        dependencies.database,
        AuthAttemptAction.REGISTRATION,
        rateSubject,
        context,
        limits.registration,
      );
      const passwordHash = await hashPassword(parsed.data.password);

      try {
        return await dependencies.database.$transaction(
          async (database) => {
            const user = await database.user.create({
              data: {
                loginNormalized,
                loginDisplay: parsed.data.login.normalize("NFKC").trim(),
                passwordHash,
                displayName: parsed.data.displayName,
                settings: { create: {} },
                onboardingState: { create: {} },
                notification: { create: {} },
              },
              include: { onboardingState: { select: { completedAt: true } } },
            });
            await revokeToken(database, context.currentSessionToken);
            const session = await createDatabaseSession(database, user.id);
            await recordAttempt(
              database,
              AuthAttemptAction.REGISTRATION,
              rateSubject,
              context,
              true,
              user.id,
            );
            return { user: publicUser(user), session };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (error instanceof AuthError) throw error;
        await recordAttempt(
          dependencies.database,
          AuthAttemptAction.REGISTRATION,
          rateSubject,
          context,
          false,
        );
        dependencies.logger.warn("registration_failed", logMetadata(context));
        throw new AuthError("REGISTRATION_FAILED");
      }
    },

    async login(
      input: unknown,
      context: RequestContext = {},
    ): Promise<AuthenticatedResult> {
      const parsed = loginInputSchema.safeParse(input);
      if (!parsed.success) throw new AuthError("INVALID_INPUT");
      let loginNormalized: string;
      try {
        loginNormalized = normalizeLogin(parsed.data.login);
      } catch {
        throw new AuthError("INVALID_CREDENTIALS");
      }
      const rateSubject = `login:${loginNormalized}`;
      await assertRateLimit(
        dependencies.database,
        AuthAttemptAction.LOGIN,
        rateSubject,
        context,
        limits.login,
      );

      const user = await dependencies.database.user.findUnique({
        where: { loginNormalized },
        include: { onboardingState: { select: { completedAt: true } } },
      });
      const passwordMatches = await verifyPasswordWithoutEnumeration(
        user?.passwordHash ?? null,
        parsed.data.password,
      );
      if (!user || user.disabledAt || !passwordMatches) {
        await recordAttempt(
          dependencies.database,
          AuthAttemptAction.LOGIN,
          rateSubject,
          context,
          false,
          user?.id,
        );
        dependencies.logger.warn("login_failed", logMetadata(context));
        throw new AuthError("INVALID_CREDENTIALS");
      }

      return dependencies.database.$transaction(
        async (database) => {
          await revokeToken(database, context.currentSessionToken);
          const session = await createDatabaseSession(database, user.id);
          await recordAttempt(
            database,
            AuthAttemptAction.LOGIN,
            rateSubject,
            context,
            true,
            user.id,
          );
          return { user: publicUser(user), session };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },

    authenticate,

    async logout(rawToken: string | undefined): Promise<void> {
      await revokeToken(dependencies.database, rawToken);
    },

    async changePassword(
      rawToken: string | undefined,
      input: unknown,
      context: RequestContext = {},
    ): Promise<AuthenticatedResult> {
      const parsed = changePasswordInputSchema.safeParse(input);
      if (!parsed.success) throw new AuthError("INVALID_INPUT");
      const authenticated = await authenticate(rawToken);
      const rateSubject = `password-change:${authenticated.id}`;
      await assertRateLimit(
        dependencies.database,
        AuthAttemptAction.PASSWORD_CHANGE,
        rateSubject,
        context,
        limits.passwordChange,
      );
      const user = await dependencies.database.user.findUniqueOrThrow({
        where: { id: authenticated.id },
      });
      const currentMatches = await verifyPasswordWithoutEnumeration(
        user.passwordHash,
        parsed.data.currentPassword,
      );
      if (!currentMatches) {
        await recordAttempt(
          dependencies.database,
          AuthAttemptAction.PASSWORD_CHANGE,
          rateSubject,
          context,
          false,
          user.id,
        );
        dependencies.logger.warn(
          "password_change_failed",
          logMetadata(context),
        );
        throw new AuthError("CURRENT_PASSWORD_INVALID");
      }
      const passwordHash = await hashPassword(parsed.data.newPassword);

      return dependencies.database.$transaction(
        async (database) => {
          await database.user.update({
            where: { id: user.id },
            data: { passwordHash },
          });
          await database.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: now() },
          });
          const session = await createDatabaseSession(database, user.id);
          await recordAttempt(
            database,
            AuthAttemptAction.PASSWORD_CHANGE,
            rateSubject,
            context,
            true,
            user.id,
          );
          return { user: authenticated, session };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
