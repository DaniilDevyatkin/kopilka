import "server-only";

import { z } from "zod";

import { MAX_MONEY_MINOR } from "@/lib/money";
import { GOAL_CATEGORY_VALUES } from "@/lib/goals/catalog";
import { isValidIanaTimeZone } from "@/lib/dates";

const nonnegativeMoneyMinorSchema = z.bigint().min(0n).max(MAX_MONEY_MINOR);
const positiveMoneyMinorSchema = z.bigint().min(1n).max(MAX_MONEY_MINOR);
const goalNameSchema = z.string().trim().min(1).max(160);

export const submitAccountStepInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((value) => value.replace(/\D/gu, "").length < 12, {
        message: "Do not store a full card number in the account name.",
      }),
    visualTheme: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    openingBalanceMinor: nonnegativeMoneyMinorSchema,
  })
  .strict();

export const submitBudgetStepInputSchema = z
  .object({
    monthlyIncomeMinor: nonnegativeMoneyMinorSchema,
    mandatoryMonthlyExpensesMinor: nonnegativeMoneyMinorSchema,
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isValidIanaTimeZone, { message: "Unknown IANA timezone." }),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mandatoryMonthlyExpensesMinor > value.monthlyIncomeMinor) {
      context.addIssue({
        code: "custom",
        path: ["mandatoryMonthlyExpensesMinor"],
        message: "Mandatory monthly expenses cannot exceed monthly income.",
      });
    }
  });

export const submitGoalStepInputSchema = z
  .discriminatedUnion("skip", [
    z.object({ skip: z.literal(true) }).strict(),
    z
      .object({
        skip: z.literal(false),
        goal: z
          .object({
            name: goalNameSchema,
            category: z.enum(GOAL_CATEGORY_VALUES),
            targetAmountMinor: positiveMoneyMinorSchema,
            targetDate: z.iso.date().nullable().optional(),
            alreadySavedMinor: nonnegativeMoneyMinorSchema,
            sourceAccountId: z.uuid().optional(),
          })
          .strict(),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    if (
      value.skip === false &&
      value.goal.alreadySavedMinor > 0n &&
      value.goal.sourceAccountId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["goal", "sourceAccountId"],
        message: "Source account is required when saving money now.",
      });
    }
  });

export type SubmitAccountStepInput = z.input<
  typeof submitAccountStepInputSchema
>;
export type ParsedSubmitAccountStepInput = z.output<
  typeof submitAccountStepInputSchema
>;
export type SubmitBudgetStepInput = z.input<typeof submitBudgetStepInputSchema>;
export type ParsedSubmitBudgetStepInput = z.output<
  typeof submitBudgetStepInputSchema
>;
export type SubmitGoalStepInput = z.input<typeof submitGoalStepInputSchema>;
export type ParsedSubmitGoalStepInput = z.output<
  typeof submitGoalStepInputSchema
>;
