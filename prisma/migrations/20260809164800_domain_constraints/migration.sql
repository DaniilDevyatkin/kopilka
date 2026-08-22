-- Constraints and partial indexes that Prisma schema cannot express.
CREATE UNIQUE INDEX "categories_system_kind_slug_key"
ON "categories"("kind", "slug")
WHERE "ownerUserId" IS NULL;

CREATE INDEX "sessions_active_user_expiresAt_idx"
ON "sessions"("userId", "expiresAt")
WHERE "revokedAt" IS NULL;

CREATE INDEX "accounts_active_user_createdAt_idx"
ON "accounts"("userId", "createdAt")
WHERE "archivedAt" IS NULL;

CREATE INDEX "goals_active_user_priority_targetDate_idx"
ON "goals"("userId", "priority", "targetDate")
WHERE "status" = 'ACTIVE';

ALTER TABLE "users"
  ADD CONSTRAINT "users_login_normalized_not_blank_check"
    CHECK (length(btrim("loginNormalized")) > 0),
  ADD CONSTRAINT "users_login_display_not_blank_check"
    CHECK (length(btrim("loginDisplay")) > 0),
  ADD CONSTRAINT "users_password_hash_not_blank_check"
    CHECK (length(btrim("passwordHash")) > 0);

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_lifetime_check"
    CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT "sessions_last_seen_check"
    CHECK ("lastSeenAt" >= "createdAt"),
  ADD CONSTRAINT "sessions_revoked_at_check"
    CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt"),
  ADD CONSTRAINT "sessions_token_hash_format_check"
    CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "auth_attempts"
  ADD CONSTRAINT "auth_attempts_blocked_until_check"
    CHECK ("blockedUntil" IS NULL OR "blockedUntil" >= "occurredAt"),
  ADD CONSTRAINT "auth_attempts_subject_hash_format_check"
    CHECK ("subjectHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "auth_attempts_network_hash_format_check"
    CHECK ("networkHash" IS NULL OR "networkHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "user_settings"
  ADD CONSTRAINT "user_settings_monthly_income_nonnegative_check"
    CHECK ("monthlyIncomeMinor" >= 0),
  ADD CONSTRAINT "user_settings_mandatory_expenses_nonnegative_check"
    CHECK ("mandatoryMonthlyExpensesMinor" >= 0),
  ADD CONSTRAINT "user_settings_timezone_not_blank_check"
    CHECK (length(btrim("timeZone")) > 0);

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_name_not_blank_check"
    CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "accounts_last4_format_check"
    CHECK ("last4" IS NULL OR "last4" ~ '^[0-9]{4}$'),
  ADD CONSTRAINT "accounts_credit_limit_policy_check"
    CHECK (
      ("type" = 'CREDIT_CARD' AND ("creditLimitMinor" IS NULL OR "creditLimitMinor" >= 0))
      OR ("type" <> 'CREDIT_CARD' AND "creditLimitMinor" IS NULL)
    );

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_slug_format_check"
    CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  ADD CONSTRAINT "categories_label_not_blank_check"
    CHECK (length(btrim("labelRu")) > 0),
  ADD CONSTRAINT "categories_icon_name_not_blank_check"
    CHECK (length(btrim("iconName")) > 0);

ALTER TABLE "financial_operations"
  ADD CONSTRAINT "financial_operations_not_self_reversal_check"
    CHECK ("reversesOperationId" IS NULL OR "reversesOperationId" <> "id"),
  ADD CONSTRAINT "financial_operations_not_self_supersession_check"
    CHECK ("supersedesOperationId" IS NULL OR "supersedesOperationId" <> "id");

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_nonzero_check"
    CHECK ("amountMinor" <> 0);

ALTER TABLE "goals"
  ADD CONSTRAINT "goals_name_not_blank_check"
    CHECK (length(btrim("name")) > 0),
  ADD CONSTRAINT "goals_target_amount_positive_check"
    CHECK ("targetAmountMinor" > 0),
  ADD CONSTRAINT "goals_actual_purchase_amount_positive_check"
    CHECK ("actualPurchaseAmountMinor" IS NULL OR "actualPurchaseAmountMinor" > 0),
  ADD CONSTRAINT "goals_completed_fields_check"
    CHECK ("status" <> 'COMPLETED' OR ("completedAt" IS NOT NULL AND "actualPurchaseAmountMinor" IS NOT NULL));

ALTER TABLE "goal_reservation_entries"
  ADD CONSTRAINT "goal_reservation_entries_amount_nonzero_check"
    CHECK ("amountMinor" <> 0),
  ADD CONSTRAINT "goal_reservation_entries_sign_check"
    CHECK (
      ("type" IN ('INITIAL_RESERVE', 'CONTRIBUTION') AND "amountMinor" > 0)
      OR ("type" IN ('WITHDRAWAL', 'RELEASE_ON_COMPLETION', 'RELEASE_ON_ARCHIVE') AND "amountMinor" < 0)
      OR "type" = 'REVERSAL'
    ),
  ADD CONSTRAINT "goal_reservation_entries_not_self_reversal_check"
    CHECK ("reversesEntryId" IS NULL OR "reversesEntryId" <> "id");

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "idempotency_keys_scope_not_blank_check"
    CHECK (length(btrim("scope")) > 0),
  ADD CONSTRAINT "idempotency_keys_key_not_blank_check"
    CHECK (length(btrim("key")) > 0),
  ADD CONSTRAINT "idempotency_keys_request_hash_format_check"
    CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "idempotency_keys_completed_at_check"
    CHECK ("completedAt" IS NULL OR "completedAt" >= "createdAt"),
  ADD CONSTRAINT "idempotency_keys_expires_at_check"
    CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt");

ALTER TABLE "image_assets"
  ADD CONSTRAINT "image_assets_mime_type_check"
    CHECK ("mimeType" IN ('image/png', 'image/jpeg', 'image/webp')),
  ADD CONSTRAINT "image_assets_dimensions_positive_check"
    CHECK ("byteSize" > 0 AND "width" > 0 AND "height" > 0),
  ADD CONSTRAINT "image_assets_integrity_hash_format_check"
    CHECK ("integrityHash" IS NULL OR "integrityHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_reminder_day_check"
    CHECK ("reminderDay" IS NULL OR "reminderDay" BETWEEN 1 AND 7),
  ADD CONSTRAINT "notification_preferences_reminder_minute_check"
    CHECK ("reminderMinute" IS NULL OR "reminderMinute" BETWEEN 0 AND 1439),
  ADD CONSTRAINT "notification_preferences_reminder_pair_check"
    CHECK (("reminderDay" IS NULL) = ("reminderMinute" IS NULL));

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_endpoint_not_blank_check"
    CHECK (length(btrim("endpoint")) > 0),
  ADD CONSTRAINT "push_subscriptions_keys_not_blank_check"
    CHECK (length(btrim("p256dh")) > 0 AND length(btrim("auth")) > 0),
  ADD CONSTRAINT "push_subscriptions_expiry_check"
    CHECK ("expiresAt" IS NULL OR "expiresAt" > "createdAt"),
  ADD CONSTRAINT "push_subscriptions_revoked_at_check"
    CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");
