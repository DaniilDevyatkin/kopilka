-- Keep self-referential financial history inside one ownership boundary.
ALTER TABLE "financial_operations"
  DROP CONSTRAINT "financial_operations_reversesOperationId_fkey",
  DROP CONSTRAINT "financial_operations_supersedesOperationId_fkey";

DROP INDEX "financial_operations_reversesOperationId_key";

CREATE UNIQUE INDEX "financial_operations_reversesOperationId_userId_key"
ON "financial_operations"("reversesOperationId", "userId");

ALTER TABLE "financial_operations"
  ADD CONSTRAINT "financial_operations_reversesOperationId_userId_fkey"
    FOREIGN KEY ("reversesOperationId", "userId")
    REFERENCES "financial_operations"("id", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "financial_operations_supersedesOperationId_userId_fkey"
    FOREIGN KEY ("supersedesOperationId", "userId")
    REFERENCES "financial_operations"("id", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "goal_reservation_entries"
  DROP CONSTRAINT "goal_reservation_entries_reversesEntryId_fkey";

DROP INDEX "goal_reservation_entries_reversesEntryId_key";

CREATE UNIQUE INDEX "goal_reservation_entries_id_userId_key"
ON "goal_reservation_entries"("id", "userId");

CREATE UNIQUE INDEX "goal_reservation_entries_reversesEntryId_userId_key"
ON "goal_reservation_entries"("reversesEntryId", "userId");

ALTER TABLE "goal_reservation_entries"
  ADD CONSTRAINT "goal_reservation_entries_reversesEntryId_userId_fkey"
    FOREIGN KEY ("reversesEntryId", "userId")
    REFERENCES "goal_reservation_entries"("id", "userId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL does not add indexes on referencing columns automatically.
CREATE INDEX "auth_attempts_userId_idx"
ON "auth_attempts"("userId");

CREATE INDEX "financial_operations_categoryId_idx"
ON "financial_operations"("categoryId");

CREATE INDEX "financial_operations_supersedesOperationId_idx"
ON "financial_operations"("supersedesOperationId");
