import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_TEST_DATABASE_URL =
  "postgresql://kopilka:kopilka_dev@localhost:5432/kopilka_operations_test?schema=public";

export function getOperationTestDatabaseUrl(): string {
  const value =
    process.env.OPERATION_TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const url = new URL(value);
  const databaseName = url.pathname.slice(1);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !/^[A-Za-z0-9_]+_test$/u.test(databaseName)
  ) {
    throw new Error(
      "Operation integration tests require a local database whose name ends with _test.",
    );
  }
  return value;
}

export async function prepareOperationTestDatabase(): Promise<void> {
  const databaseUrl = new URL(getOperationTestDatabaseUrl());
  const databaseName = databaseUrl.pathname.slice(1);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [databaseName],
    );
    if (!existing.rows[0]?.exists) {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await admin.end();
  }

  const database = new Client({ connectionString: databaseUrl.toString() });
  await database.connect();
  try {
    await database.query(
      "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public",
    );
    const migrationsRoot = path.resolve("prisma/migrations");
    const entries = (await readdir(migrationsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const entry of entries) {
      const sql = await readFile(
        path.join(migrationsRoot, entry, "migration.sql"),
        "utf8",
      );
      await database.query(sql);
    }
  } finally {
    await database.end();
  }
}

export function createOperationTestClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getOperationTestDatabaseUrl() }),
  });
}
