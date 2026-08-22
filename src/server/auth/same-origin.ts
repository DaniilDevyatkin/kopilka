import "server-only";

export class SameOriginError extends Error {
  override readonly name = "SameOriginError";
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isEquivalentLoopbackOrigin(actual: URL, expected: URL): boolean {
  return (
    LOOPBACK_HOSTNAMES.has(actual.hostname) &&
    LOOPBACK_HOSTNAMES.has(expected.hostname) &&
    actual.protocol === expected.protocol &&
    actual.port === expected.port
  );
}

export function assertSameOrigin(
  headers: Headers,
  applicationOrigin: string,
): void {
  let expectedUrl: URL;
  try {
    expectedUrl = new URL(applicationOrigin);
  } catch {
    throw new SameOriginError(
      "Application origin is not configured correctly.",
    );
  }

  const suppliedOrigin = headers.get("origin");
  const fetchSite = headers.get("sec-fetch-site");

  if (!suppliedOrigin || suppliedOrigin === "null") {
    throw new SameOriginError("Mutation origin is required.");
  }

  let actualUrl: URL;
  try {
    actualUrl = new URL(suppliedOrigin);
  } catch {
    throw new SameOriginError("Mutation origin is invalid.");
  }

  const originMatches =
    actualUrl.origin === expectedUrl.origin ||
    isEquivalentLoopbackOrigin(actualUrl, expectedUrl);

  if (!originMatches || fetchSite === "cross-site") {
    throw new SameOriginError("Cross-origin mutation is not allowed.");
  }
}
