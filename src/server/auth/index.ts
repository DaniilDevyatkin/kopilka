import "server-only";

import { getServerEnvironment } from "@/lib/env/server";
import { authLogger } from "@/server/auth/logger";
import { createAuthService } from "@/server/auth/service";
import { prisma } from "@/server/db/prisma";

const environment = getServerEnvironment();

export const authService = createAuthService({
  database: prisma,
  sessionSecret: environment.SESSION_SECRET,
  logger: authLogger,
});
