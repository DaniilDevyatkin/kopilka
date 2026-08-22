import { z } from "zod";

const integerMinorSchema = z
  .string()
  .regex(/^-?\d+$/u)
  .max(32);
const nonNegativeMinorSchema = z.string().regex(/^\d+$/u).max(32);

const offlineAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    type: z.string().trim().min(1).max(32),
    balanceMinor: integerMinorSchema,
  })
  .strict();

const offlineGoalSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    targetAmountMinor: nonNegativeMinorSchema,
    reservedAmountMinor: nonNegativeMinorSchema,
    targetDate: z.iso.date().nullable(),
  })
  .strict();

const offlineOperationSchema = z
  .object({
    kind: z.enum(["INCOME", "EXPENSE", "TRANSFER", "GOAL_PURCHASE"]),
    amountMinor: integerMinorSchema,
    comment: z.string().trim().max(500).nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const offlineSnapshotSchema = z
  .object({
    version: z.literal(1),
    savedAt: z.iso.datetime({ offset: true }),
    currency: z.enum(["RUB", "EUR", "USD", "KZT", "GEL"]),
    totalCapitalMinor: integerMinorSchema,
    reservedMinor: nonNegativeMinorSchema,
    freeMinor: integerMinorSchema,
    accounts: z.array(offlineAccountSchema).max(50),
    goals: z.array(offlineGoalSchema).max(50),
    operations: z.array(offlineOperationSchema).max(50),
  })
  .strict();

export type OfflineSnapshot = z.output<typeof offlineSnapshotSchema>;

const DATABASE_NAME = "kopilka-read-only";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "financial";

function browserDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB open failed."));
  });
}

export async function saveOfflineSnapshot(
  value: OfflineSnapshot,
): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const snapshot = offlineSnapshotSchema.parse(value);
  const database = await browserDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(snapshot, SNAPSHOT_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Snapshot write failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Snapshot write aborted."));
    });
  } finally {
    database.close();
  }
}

export async function clearOfflineSnapshot(): Promise<void> {
  if (typeof window === "undefined") return;
  if ("indexedDB" in window) {
    try {
      const database = await browserDatabase();
      await new Promise<void>((resolve) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      });
      database.close();
    } catch {
      // Logout must continue even if a privacy cleanup API is unavailable.
    }
    await new Promise<void>((resolve) => {
      const request = window.indexedDB.deleteDatabase(DATABASE_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
  navigator.serviceWorker?.controller?.postMessage({
    type: "CLEAR_PRIVATE_DATA",
  });
}
