-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('RUB', 'EUR', 'USD', 'KZT', 'GEL');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "OnboardingStep" AS ENUM ('ACCOUNT', 'BUDGET', 'GOAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('DEBIT_CARD', 'CREDIT_CARD', 'CASH', 'SAVINGS', 'BANK_ACCOUNT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'OPENING_BALANCE', 'BALANCE_ADJUSTMENT', 'GOAL_PURCHASE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "LedgerEntryRole" AS ENUM ('PRIMARY', 'TRANSFER_SOURCE', 'TRANSFER_DESTINATION', 'REVERSAL');

-- CreateEnum
CREATE TYPE "GoalCategory" AS ENUM ('TECH', 'TRAVEL', 'CAR', 'HOUSING', 'EDUCATION', 'GIFT', 'CLOTHES', 'HEALTH', 'HOBBY', 'EMERGENCY_FUND', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GoalReservationType" AS ENUM ('INITIAL_RESERVE', 'CONTRIBUTION', 'WITHDRAWAL', 'RELEASE_ON_COMPLETION', 'RELEASE_ON_ARCHIVE', 'REVERSAL');

-- CreateEnum
CREATE TYPE "IdempotencyState" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED_RETRYABLE');

-- CreateEnum
CREATE TYPE "AuthAttemptAction" AS ENUM ('REGISTRATION', 'LOGIN', 'PASSWORD_CHANGE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "loginNormalized" VARCHAR(191) NOT NULL,
    "loginDisplay" VARCHAR(191) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" VARCHAR(120),
    "baseCurrency" "Currency" NOT NULL DEFAULT 'RUB',
    "disabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "subjectHash" CHAR(64) NOT NULL,
    "networkHash" CHAR(64),
    "action" "AuthAttemptAction" NOT NULL,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMPTZ(3),

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" UUID NOT NULL,
    "monthlyIncomeMinor" BIGINT NOT NULL DEFAULT 0,
    "mandatoryMonthlyExpensesMinor" BIGINT NOT NULL DEFAULT 0,
    "timeZone" VARCHAR(100) NOT NULL DEFAULT 'Europe/Moscow',
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "privacyModeDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "onboarding_states" (
    "userId" UUID NOT NULL,
    "currentStep" "OnboardingStep" NOT NULL DEFAULT 'ACCOUNT',
    "firstAccountCompletedAt" TIMESTAMPTZ(3),
    "budgetCompletedAt" TIMESTAMPTZ(3),
    "goalStepCompletedAt" TIMESTAMPTZ(3),
    "goalStepSkippedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "onboarding_states_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "visualTheme" VARCHAR(64) NOT NULL DEFAULT 'default',
    "last4" CHAR(4),
    "creditLimitMinor" BIGINT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID,
    "kind" "CategoryKind" NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "labelRu" VARCHAR(80) NOT NULL,
    "iconName" VARCHAR(80) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_operations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "OperationType" NOT NULL,
    "categoryId" UUID,
    "goalId" UUID,
    "note" VARCHAR(500),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "reversesOperationId" UUID,
    "supersedesOperationId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "role" "LedgerEntryRole" NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" "GoalCategory" NOT NULL,
    "description" VARCHAR(1000),
    "targetAmountMinor" BIGINT NOT NULL,
    "targetDate" DATE,
    "priority" "GoalPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "imageAssetId" UUID,
    "completedAt" TIMESTAMPTZ(3),
    "actualPurchaseAmountMinor" BIGINT,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_reservation_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "sourceAccountId" UUID NOT NULL,
    "type" "GoalReservationType" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "note" VARCHAR(500),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "reversesEntryId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_reservation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "scope" VARCHAR(80) NOT NULL,
    "key" VARCHAR(191) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "state" "IdempotencyState" NOT NULL DEFAULT 'PROCESSING',
    "resourceType" VARCHAR(80),
    "resourceId" UUID,
    "resultJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_assets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "integrityHash" CHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" UUID NOT NULL,
    "weeklyReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderDay" INTEGER,
    "reminderMinute" INTEGER,
    "nearGoalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "goalCompletedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_loginNormalized_key" ON "users"("loginNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_attempts_subjectHash_action_occurredAt_idx" ON "auth_attempts"("subjectHash", "action", "occurredAt");

-- CreateIndex
CREATE INDEX "auth_attempts_networkHash_action_occurredAt_idx" ON "auth_attempts"("networkHash", "action", "occurredAt");

-- CreateIndex
CREATE INDEX "auth_attempts_blockedUntil_idx" ON "auth_attempts"("blockedUntil");

-- CreateIndex
CREATE INDEX "accounts_userId_archivedAt_idx" ON "accounts"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "accounts_userId_type_idx" ON "accounts"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_userId_key" ON "accounts"("id", "userId");

-- CreateIndex
CREATE INDEX "categories_ownerUserId_kind_archivedAt_idx" ON "categories"("ownerUserId", "kind", "archivedAt");

-- CreateIndex
CREATE INDEX "categories_kind_sortOrder_idx" ON "categories"("kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "categories_ownerUserId_kind_slug_key" ON "categories"("ownerUserId", "kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "financial_operations_reversesOperationId_key" ON "financial_operations"("reversesOperationId");

-- CreateIndex
CREATE INDEX "financial_operations_userId_occurredAt_idx" ON "financial_operations"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_operations_userId_type_occurredAt_idx" ON "financial_operations"("userId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_operations_userId_categoryId_occurredAt_idx" ON "financial_operations"("userId", "categoryId", "occurredAt");

-- CreateIndex
CREATE INDEX "financial_operations_userId_goalId_occurredAt_idx" ON "financial_operations"("userId", "goalId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "financial_operations_id_userId_key" ON "financial_operations"("id", "userId");

-- CreateIndex
CREATE INDEX "ledger_entries_userId_accountId_createdAt_idx" ON "ledger_entries"("userId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_userId_operationId_idx" ON "ledger_entries"("userId", "operationId");

-- CreateIndex
CREATE INDEX "goals_userId_status_priority_idx" ON "goals"("userId", "status", "priority");

-- CreateIndex
CREATE INDEX "goals_userId_targetDate_idx" ON "goals"("userId", "targetDate");

-- CreateIndex
CREATE INDEX "goals_userId_category_idx" ON "goals"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "goals_id_userId_key" ON "goals"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "goals_imageAssetId_userId_key" ON "goals"("imageAssetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "goal_reservation_entries_reversesEntryId_key" ON "goal_reservation_entries"("reversesEntryId");

-- CreateIndex
CREATE INDEX "goal_reservation_entries_userId_goalId_occurredAt_idx" ON "goal_reservation_entries"("userId", "goalId", "occurredAt");

-- CreateIndex
CREATE INDEX "goal_reservation_entries_userId_sourceAccountId_occurredAt_idx" ON "goal_reservation_entries"("userId", "sourceAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_userId_state_createdAt_idx" ON "idempotency_keys"("userId", "state", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_userId_scope_key_key" ON "idempotency_keys"("userId", "scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_storageKey_key" ON "image_assets"("storageKey");

-- CreateIndex
CREATE INDEX "image_assets_userId_deletedAt_idx" ON "image_assets"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "image_assets_id_userId_key" ON "image_assets"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_revokedAt_idx" ON "push_subscriptions"("userId", "revokedAt");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_attempts" ADD CONSTRAINT "auth_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "goals"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_reversesOperationId_fkey" FOREIGN KEY ("reversesOperationId") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_operations" ADD CONSTRAINT "financial_operations_supersedesOperationId_fkey" FOREIGN KEY ("supersedesOperationId") REFERENCES "financial_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_operationId_userId_fkey" FOREIGN KEY ("operationId", "userId") REFERENCES "financial_operations"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_userId_fkey" FOREIGN KEY ("accountId", "userId") REFERENCES "accounts"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_imageAssetId_userId_fkey" FOREIGN KEY ("imageAssetId", "userId") REFERENCES "image_assets"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_reservation_entries" ADD CONSTRAINT "goal_reservation_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_reservation_entries" ADD CONSTRAINT "goal_reservation_entries_goalId_userId_fkey" FOREIGN KEY ("goalId", "userId") REFERENCES "goals"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_reservation_entries" ADD CONSTRAINT "goal_reservation_entries_sourceAccountId_userId_fkey" FOREIGN KEY ("sourceAccountId", "userId") REFERENCES "accounts"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_reservation_entries" ADD CONSTRAINT "goal_reservation_entries_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "goal_reservation_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
