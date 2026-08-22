import "server-only";

import { z } from "zod";

import { MAX_MONEY_MINOR } from "@/lib/money";

const OPERATION_KINDS = ["INCOME", "EXPENSE"] as const;

const positiveMoneyMinorSchema = z.bigint().min(1n).max(MAX_MONEY_MINOR);
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(191)
  .regex(/^[A-Za-z0-9._:-]+$/u);
const commentSchema = z.string().trim().max(500).optional();
const occurredAtSchema = z.iso.datetime({ offset: true });

export const createOperationInputSchema = z
  .object({
    kind: z.enum(OPERATION_KINDS),
    amountMinor: positiveMoneyMinorSchema,
    accountId: z.uuid(),
    categoryId: z.uuid(),
    comment: commentSchema,
    occurredAt: occurredAtSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const editOperationInputSchema = z
  .object({
    operationId: z.uuid(),
    kind: z.enum(OPERATION_KINDS),
    amountMinor: positiveMoneyMinorSchema,
    accountId: z.uuid(),
    categoryId: z.uuid(),
    comment: commentSchema,
    occurredAt: occurredAtSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const cancelOperationInputSchema = z
  .object({
    operationId: z.uuid(),
    occurredAt: occurredAtSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export type CreateOperationInput = z.input<typeof createOperationInputSchema>;
export type ParsedCreateOperationInput = z.output<
  typeof createOperationInputSchema
>;
export type EditOperationInput = z.input<typeof editOperationInputSchema>;
export type ParsedEditOperationInput = z.output<
  typeof editOperationInputSchema
>;
export type CancelOperationInput = z.input<typeof cancelOperationInputSchema>;
export type ParsedCancelOperationInput = z.output<
  typeof cancelOperationInputSchema
>;
