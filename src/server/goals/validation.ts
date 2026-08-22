import "server-only";

import { z } from "zod";

import { GOAL_CATEGORY_VALUES, GOAL_PRIORITIES } from "@/lib/goals/catalog";
import { MAX_MONEY_MINOR } from "@/lib/money";

const positiveMoneyMinorSchema = z.bigint().min(1n).max(MAX_MONEY_MINOR);
const goalNameSchema = z.string().trim().min(1).max(160);
const descriptionSchema = z.string().trim().max(1000);
const targetDateSchema = z.iso.date();
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(191)
  .regex(/^[A-Za-z0-9._:-]+$/u);

export const initialGoalReservationSchema = z
  .object({
    sourceAccountId: z.uuid(),
    amountMinor: positiveMoneyMinorSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const createGoalInputSchema = z
  .object({
    name: goalNameSchema,
    category: z.enum(GOAL_CATEGORY_VALUES),
    description: descriptionSchema.optional(),
    targetAmountMinor: positiveMoneyMinorSchema,
    targetDate: targetDateSchema.nullable().optional(),
    priority: z.enum(GOAL_PRIORITIES).default("MEDIUM"),
    imageAssetId: z.uuid().optional(),
    initialReservation: initialGoalReservationSchema.optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const updateGoalInputSchema = z
  .object({
    goalId: z.uuid(),
    name: goalNameSchema.optional(),
    category: z.enum(GOAL_CATEGORY_VALUES).optional(),
    description: descriptionSchema.nullable().optional(),
    targetAmountMinor: positiveMoneyMinorSchema.optional(),
    targetDate: targetDateSchema.nullable().optional(),
    priority: z.enum(GOAL_PRIORITIES).optional(),
    imageAssetId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.category !== undefined ||
      value.description !== undefined ||
      value.targetAmountMinor !== undefined ||
      value.targetDate !== undefined ||
      value.priority !== undefined ||
      value.imageAssetId !== undefined,
    { message: "At least one goal field is required." },
  );

export const goalIdSchema = z.uuid();
export const goalListViewSchema = z.enum(["ACTIVE", "ARCHIVE"]);

const reserveMutationFields = {
  goalId: z.uuid(),
  sourceAccountId: z.uuid(),
  amountMinor: positiveMoneyMinorSchema,
  occurredAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
} as const;

export const contributeGoalInputSchema = z
  .object({ ...reserveMutationFields })
  .strict();
export const withdrawGoalInputSchema = z
  .object({ ...reserveMutationFields })
  .strict();

export const completeGoalInputSchema = z
  .object({
    goalId: z.uuid(),
    paymentAccountId: z.uuid(),
    actualPurchaseAmountMinor: positiveMoneyMinorSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    note: z.string().trim().max(500).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export type ContributeGoalInput = z.input<typeof contributeGoalInputSchema>;
export type ParsedContributeGoalInput = z.output<
  typeof contributeGoalInputSchema
>;
export type WithdrawGoalInput = z.input<typeof withdrawGoalInputSchema>;
export type ParsedWithdrawGoalInput = z.output<typeof withdrawGoalInputSchema>;
export type CompleteGoalInput = z.input<typeof completeGoalInputSchema>;
export type ParsedCompleteGoalInput = z.output<typeof completeGoalInputSchema>;

export type CreateGoalInput = z.input<typeof createGoalInputSchema>;
export type ParsedCreateGoalInput = z.output<typeof createGoalInputSchema>;
export type UpdateGoalInput = z.input<typeof updateGoalInputSchema>;
export type ParsedUpdateGoalInput = z.output<typeof updateGoalInputSchema>;
export type GoalListView = z.output<typeof goalListViewSchema>;
