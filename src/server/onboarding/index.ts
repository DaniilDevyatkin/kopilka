import "server-only";

import { accountService } from "@/server/accounts/index";
import { prisma } from "@/server/db/prisma";
import { goalService } from "@/server/goals/index";
import { createOnboardingService } from "@/server/onboarding/service";

export const onboardingService = createOnboardingService({
  database: prisma,
  accountService,
  goalService,
});
