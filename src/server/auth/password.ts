import "server-only";

import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function verifyPasswordWithoutEnumeration(
  hash: string | null,
  password: string,
): Promise<boolean> {
  dummyHash ??= hashPassword("kopilka-dummy-password-never-used-for-login");

  try {
    const verified = await verifyPassword(hash ?? (await dummyHash), password);
    return hash !== null && verified;
  } catch {
    return false;
  }
}
