ALTER TABLE "goals"
  DROP CONSTRAINT "goals_completed_fields_check",
  ADD CONSTRAINT "goals_lifecycle_fields_check"
    CHECK (
      (
        "status" = 'ACTIVE'
        AND "completedAt" IS NULL
        AND "actualPurchaseAmountMinor" IS NULL
        AND "archivedAt" IS NULL
      )
      OR (
        "status" = 'ARCHIVED'
        AND "completedAt" IS NULL
        AND "actualPurchaseAmountMinor" IS NULL
        AND "archivedAt" IS NOT NULL
      )
      OR (
        "status" = 'CANCELLED'
        AND "completedAt" IS NULL
        AND "actualPurchaseAmountMinor" IS NULL
        AND "archivedAt" IS NOT NULL
      )
      OR (
        "status" = 'COMPLETED'
        AND "completedAt" IS NOT NULL
        AND "actualPurchaseAmountMinor" IS NOT NULL
        AND "archivedAt" IS NOT NULL
      )
    );
