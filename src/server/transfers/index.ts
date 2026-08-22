import "server-only";

import { prisma } from "@/server/db/prisma";
import { createTransferService } from "@/server/transfers/service";

export const transferService = createTransferService({ database: prisma });
