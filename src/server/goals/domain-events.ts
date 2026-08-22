import "server-only";

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import type { Goal } from "@/generated/prisma/client";

export interface GoalCompletedEventData {
  goalId: string;
  userId: string;
  name: string;
  category: Goal["category"];
  targetAmountMinor: bigint;
  actualPurchaseAmountMinor: bigint;
  releasedReserveAmountMinor: bigint;
  purchaseOperationId: string;
}

export interface GoalDomainEvent {
  id: string;
  type: "goal.completed";
  version: 1;
  occurredAt: Date;
  data: GoalCompletedEventData;
}

// ponytail: in-process emitter, no external infrastructure; swap for a queue when cross-instance delivery matters
const emitter = new EventEmitter();

export function publishGoalDomainEvent(event: GoalDomainEvent): void {
  emitter.emit(event.type, event);
}

export function subscribeGoalDomainEvents(
  listener: (event: GoalDomainEvent) => void,
): () => void {
  emitter.on("goal.completed", listener);
  return () => {
    emitter.off("goal.completed", listener);
  };
}

export function goalCompletedEvent(
  data: GoalCompletedEventData,
  occurredAt: Date,
): GoalDomainEvent {
  return {
    id: randomUUID(),
    type: "goal.completed",
    version: 1,
    occurredAt,
    data,
  };
}
