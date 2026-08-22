import "server-only";

import { z } from "zod";

import { MAX_MONEY_MINOR, MIN_MONEY_MINOR } from "@/lib/money";

export const ACCOUNT_TYPES = [
  "DEBIT_CARD",
  "CREDIT_CARD",
  "CASH",
  "SAVINGS",
  "BANK_ACCOUNT",
  "CUSTOM",
] as const;

export const ACCOUNT_CURRENCIES = ["RUB", "EUR", "USD", "KZT", "GEL"] as const;

const moneyMinorSchema = z.bigint().min(MIN_MONEY_MINOR).max(MAX_MONEY_MINOR);
const nonnegativeMoneyMinorSchema = z.bigint().min(0n).max(MAX_MONEY_MINOR);
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(191)
  .regex(/^[A-Za-z0-9._:-]+$/u);
const accountNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => value.replace(/\D/gu, "").length < 12, {
    message: "Do not store a full card number in the account name.",
  });
const visualThemeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const last4Schema = z.string().regex(/^\d{4}$/u);

export const createAccountFieldsInputSchema = z
  .object({
    name: accountNameSchema,
    type: z.enum(ACCOUNT_TYPES),
    currency: z.enum(ACCOUNT_CURRENCIES),
    visualTheme: visualThemeSchema.default("default"),
    imageAssetId: z.uuid().optional(),
    last4: last4Schema.optional(),
    creditLimitMinor: nonnegativeMoneyMinorSchema.optional(),
    openingBalanceMinor: moneyMinorSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const isCard = value.type === "DEBIT_CARD" || value.type === "CREDIT_CARD";
    if (!isCard && value.last4 !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["last4"],
        message: "last4 is available only for card accounts.",
      });
    }

    if (value.type !== "CREDIT_CARD") {
      if (value.creditLimitMinor !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["creditLimitMinor"],
          message: "Credit limit is available only for credit cards.",
        });
      }
      if (value.openingBalanceMinor < 0n) {
        context.addIssue({
          code: "custom",
          path: ["openingBalanceMinor"],
          message: "Non-credit opening balance cannot be negative.",
        });
      }
      return;
    }

    const limit = value.creditLimitMinor ?? 0n;
    if (value.openingBalanceMinor < -limit) {
      context.addIssue({
        code: "custom",
        path: ["openingBalanceMinor"],
        message: "Opening debt exceeds the credit limit.",
      });
    }
  });

export const createAccountInputSchema = createAccountFieldsInputSchema.extend({
  idempotencyKey: idempotencyKeySchema,
});

export const updateAccountInputSchema = z
  .object({
    accountId: z.uuid(),
    name: accountNameSchema.optional(),
    visualTheme: visualThemeSchema.optional(),
    imageAssetId: z.uuid().nullable().optional(),
    last4: last4Schema.nullable().optional(),
    creditLimitMinor: nonnegativeMoneyMinorSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.visualTheme !== undefined ||
      value.imageAssetId !== undefined ||
      value.last4 !== undefined ||
      value.creditLimitMinor !== undefined,
    { message: "At least one metadata field is required." },
  );

export const reconcileAccountInputSchema = z
  .object({
    accountId: z.uuid(),
    actualBalanceMinor: moneyMinorSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const accountIdSchema = z.uuid();

export const accountMonthSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u);

export type CreateAccountInput = z.input<typeof createAccountInputSchema>;
export type ParsedCreateAccountInput = z.output<
  typeof createAccountInputSchema
>;
export type UpdateAccountInput = z.input<typeof updateAccountInputSchema>;
export type ReconcileAccountInput = z.input<typeof reconcileAccountInputSchema>;
export type ParsedReconcileAccountInput = z.output<
  typeof reconcileAccountInputSchema
>;
