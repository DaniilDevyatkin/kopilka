import "server-only";

import { isIP } from "node:net";

function validatedIp(value: string | null): string | undefined {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}

/**
 * Forwarding headers are authenticated infrastructure metadata only when the
 * deployment explicitly guarantees that a trusted proxy overwrites them.
 */
export function getTrustedNetworkIdentifier(
  requestHeaders: Headers,
  trustProxyHeaders: boolean,
): string | undefined {
  if (!trustProxyHeaders) return undefined;

  return (
    validatedIp(requestHeaders.get("x-real-ip")) ??
    validatedIp(requestHeaders.get("x-forwarded-for")?.split(",")[0] ?? null)
  );
}
