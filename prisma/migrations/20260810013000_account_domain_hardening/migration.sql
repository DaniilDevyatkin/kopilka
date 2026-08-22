-- Account-domain constraints that complement the transactional service.
ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_visual_theme_format_check"
    CHECK ("visualTheme" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  ADD CONSTRAINT "accounts_last4_card_only_check"
    CHECK (
      "last4" IS NULL
      OR "type" IN ('DEBIT_CARD', 'CREDIT_CARD')
    );

-- Opening balances, adjustments and transfers may post at most once per account.
CREATE UNIQUE INDEX "ledger_entries_operationId_accountId_key"
ON "ledger_entries"("operationId", "accountId");
