import type { ReactNode } from "react";

import { AuthShell } from "@/components/layout/auth-shell";
import { guardPublicAuthRoute } from "@/server/auth/route-guards";

export default async function PublicAuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  await guardPublicAuthRoute();
  return <AuthShell>{children}</AuthShell>;
}
