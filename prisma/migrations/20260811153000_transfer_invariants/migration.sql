-- A transfer (and a reversal of a transfer) must be balanced at commit time.
-- Deferred constraint triggers allow the header and both entries to be inserted
-- in any order inside one transaction, but reject every partial final state.
CREATE FUNCTION "assert_transfer_operation_balanced"("operation_id" UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  "operation_type" "OperationType";
  "reversed_operation_id" UUID;
  "reversed_operation_type" "OperationType";
  "entry_count" BIGINT;
  "entry_sum" NUMERIC;
  "source_count" BIGINT;
  "destination_count" BIGINT;
  "reversal_count" BIGINT;
BEGIN
  SELECT "type", "reversesOperationId"
  INTO "operation_type", "reversed_operation_id"
  FROM "financial_operations"
  WHERE "id" = "operation_id";

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF "operation_type" = 'REVERSAL' AND "reversed_operation_id" IS NOT NULL THEN
    SELECT "type"
    INTO "reversed_operation_type"
    FROM "financial_operations"
    WHERE "id" = "reversed_operation_id";
  END IF;

  IF "operation_type" <> 'TRANSFER'
     AND NOT (
       "operation_type" = 'REVERSAL'
       AND "reversed_operation_type" = 'TRANSFER'
     ) THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(SUM("amountMinor"), 0),
    COUNT(*) FILTER (
      WHERE "role" = 'TRANSFER_SOURCE' AND "amountMinor" < 0
    ),
    COUNT(*) FILTER (
      WHERE "role" = 'TRANSFER_DESTINATION' AND "amountMinor" > 0
    ),
    COUNT(*) FILTER (WHERE "role" = 'REVERSAL')
  INTO
    "entry_count",
    "entry_sum",
    "source_count",
    "destination_count",
    "reversal_count"
  FROM "ledger_entries"
  WHERE "operationId" = "operation_id";

  IF "operation_type" = 'TRANSFER' THEN
    IF "entry_count" <> 2
       OR "entry_sum" <> 0
       OR "source_count" <> 1
       OR "destination_count" <> 1 THEN
      RAISE EXCEPTION 'transfer must have one negative source and one equal positive destination entry'
        USING ERRCODE = '23514',
              CONSTRAINT = 'transfer_operation_balanced_check';
    END IF;
  ELSIF "entry_count" <> 2
        OR "entry_sum" <> 0
        OR "reversal_count" <> 2 THEN
    RAISE EXCEPTION 'transfer reversal must contain two opposite entries'
      USING ERRCODE = '23514',
            CONSTRAINT = 'transfer_reversal_balanced_check';
  END IF;
END;
$$;

CREATE FUNCTION "check_transfer_operation_from_header"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM "assert_transfer_operation_balanced"(NEW."id");
  RETURN NULL;
END;
$$;

CREATE FUNCTION "check_transfer_operation_from_entry"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "assert_transfer_operation_balanced"(OLD."operationId");
  ELSE
    PERFORM "assert_transfer_operation_balanced"(NEW."operationId");
    IF TG_OP = 'UPDATE' AND OLD."operationId" <> NEW."operationId" THEN
      PERFORM "assert_transfer_operation_balanced"(OLD."operationId");
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "financial_operations_transfer_balanced_trigger"
AFTER INSERT OR UPDATE OF "type", "reversesOperationId"
ON "financial_operations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "check_transfer_operation_from_header"();

CREATE CONSTRAINT TRIGGER "ledger_entries_transfer_balanced_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "check_transfer_operation_from_entry"();
