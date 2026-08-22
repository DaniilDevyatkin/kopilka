import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { guardPrivateRoute } from "@/server/auth/route-guards";

export default async function PrivateAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  await guardPrivateRoute();
  return <AppShell>{children}</AppShell>;
}
