import "server-only";

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import path from "node:path";

/**
 * Контракт object storage для upload хотелок.
 * Ключи генерируются сервером и имеют вид `goals/<userId>/<uuid>.<ext>`.
 */
export interface StorageAdapter {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  list(userId: string): Promise<string[]>;
}

const SAFE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/u;

function assertSafeKey(key: string): void {
  if (
    !SAFE_KEY_PATTERN.test(key) ||
    key.includes("..") ||
    key.startsWith("/") ||
    key.endsWith("/")
  ) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDirectory: string) {}

  private pathFor(key: string): string {
    assertSafeKey(key);
    const root = path.resolve(this.rootDirectory);
    const absolute = path.resolve(root, ...key.split("/"));
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      throw new Error(`Storage key escapes root: ${key}`);
    }
    return absolute;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.pathFor(key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async list(userId: string): Promise<string[]> {
    const namespaces = ["goals", "accounts"] as const;
    const groups = await Promise.all(
      namespaces.map(async (namespace) => {
        const directory = this.pathFor(`${namespace}/${userId}`);
        try {
          const entries = await readdir(directory, { withFileTypes: true });
          return entries
            .filter((entry) => entry.isFile())
            .map((entry) => `${namespace}/${userId}/${entry.name}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
          throw error;
        }
      }),
    );
    return groups.flat();
  }
}

interface S3StorageOptions {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function xmlValues(xml: string, name: string): string[] {
  const pattern = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "gu");
  return [...xml.matchAll(pattern)].map((match) =>
    (match[1] ?? "")
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">"),
  );
}

/** Minimal SigV4 S3-compatible adapter, avoiding a large runtime SDK. */
export class S3StorageAdapter implements StorageAdapter {
  private readonly endpoint: URL;

  constructor(private readonly options: S3StorageOptions) {
    this.endpoint = new URL(options.endpoint);
  }

  private async request(
    method: "GET" | "PUT" | "DELETE",
    key = "",
    query: Record<string, string> = {},
    body?: Uint8Array,
  ): Promise<Response> {
    if (key) assertSafeKey(key);
    const encodedPath = [this.options.bucket, ...key.split("/")]
      .filter(Boolean)
      .map(encodeURIComponent)
      .join("/");
    const url = new URL(this.endpoint);
    url.pathname = `${url.pathname.replace(/\/$/u, "")}/${encodedPath}`;
    const canonicalQuery = Object.entries(query)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([name, value]) =>
          `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
      )
      .join("&");
    url.search = canonicalQuery;
    const instant = new Date();
    const amzDate = instant.toISOString().replace(/[:-]|\.\d{3}/gu, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256(body ?? new Uint8Array());
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${date}/${this.options.region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const dateKey = hmac(`AWS4${this.options.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, this.options.region);
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");
    return fetch(url, {
      method,
      headers: {
        authorization: `AWS4-HMAC-SHA256 Credential=${this.options.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
      ...(body ? { body: Buffer.from(body) } : {}),
    });
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const response = await this.request("PUT", key, {}, bytes);
    if (!response.ok)
      throw new Error(`Object storage put failed (${response.status}).`);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const response = await this.request("GET", key);
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Object storage get failed (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const response = await this.request("DELETE", key);
    if (!response.ok && response.status !== 404)
      throw new Error(`Object storage delete failed (${response.status}).`);
  }

  private async listPrefix(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken = "";
    do {
      const response = await this.request("GET", "", {
        "list-type": "2",
        prefix,
        ...(continuationToken
          ? { "continuation-token": continuationToken }
          : {}),
      });
      if (!response.ok)
        throw new Error(`Object storage list failed (${response.status}).`);
      const xml = await response.text();
      keys.push(...xmlValues(xml, "Key"));
      continuationToken = xmlValues(xml, "NextContinuationToken")[0] ?? "";
    } while (continuationToken);
    return keys;
  }

  async list(userId: string): Promise<string[]> {
    return (
      await Promise.all([
        this.listPrefix(`goals/${userId}/`),
        this.listPrefix(`accounts/${userId}/`),
      ])
    ).flat();
  }
}

export function createStorageAdapter(
  driver: string,
  localDirectory: string,
  s3?: S3StorageOptions,
): StorageAdapter {
  if (driver === "s3") {
    if (!s3?.bucket || !s3.endpoint || !s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error(
        "S3 storage requires endpoint, bucket, region and credentials.",
      );
    }
    return new S3StorageAdapter(s3);
  }
  return new LocalStorageAdapter(localDirectory);
}
