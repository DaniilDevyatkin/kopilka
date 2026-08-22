import "server-only";

import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", service: "kopilka", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", service: "kopilka" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
