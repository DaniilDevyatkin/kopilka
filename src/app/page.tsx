import { redirect } from "next/navigation";

import { getAuthenticatedUserOrNull } from "@/server/auth/current-user";

export default async function EntryPage() {
  const user = await getAuthenticatedUserOrNull();
  if (!user) redirect("/login");
  redirect(user.onboardingCompleted ? "/app/home" : "/onboarding");
}
