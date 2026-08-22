import "server-only";

import { z } from "zod";

import { MAX_MONEY_MINOR } from "@/lib/money";

const transferIdSchema = z.uuid();
const accountIdSchema = z.uuid();
const amountMinorSchema = z.bigint().min(1n).max(MAX_MONEY_MINOR);
const commentSchema = z.string().trim().max(500).optional();
const occurredAtSchema = z.iso.datetime({ offset: true });
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(191)
  .regex(/^[A-Za-z0-9._:-]+$/u);

const transferFields = {
  amountMinor: amountMinorSchema,
  sourceAccountId: accountIdSchema,
  destinationAccountId: accountIdSchema,
  comment: commentSchema,
  occurredAt: occurredAtSchema,
  idempotencyKey: idempotencyKeySchema,
};

export const createTransferInputSchema = z.object(transferFields).strict();

export const editTransferInputSchema = z
  .object({ transferId: transferIdSchema, ...transferFields })
  .strict();

export const cancelTransferInputSchema = z
  .object({
    transferId: transferIdSchema,
    comment: commentSchema,
    occurredAt: occurredAtSchema,
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export type CreateTransferInput = z.input<typeof createTransferInputSchema>;
export type ParsedCreateTransferInput = z.output<
  typeof createTransferInputSchema
>;
export type EditTransferInput = z.input<typeof editTransferInputSchema>;
export type ParsedEditTransferInput = z.output<typeof editTransferInputSchema>;
export type CancelTransferInput = z.input<typeof cancelTransferInputSchema>;
export type ParsedCancelTransferInput = z.output<
  typeof cancelTransferInputSchema
>;
