import { connection } from "next/server";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export default async function PrivateAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Private pages are request-bound. Their individual page guards perform the
  // DB-backed authorization; this prevents build-time prerendering without
  // introducing a second concurrent redirect in the layout.
  await connection();
  return <AppShell>{children}</AppShell>;
}
