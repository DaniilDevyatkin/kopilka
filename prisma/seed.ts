import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { SYSTEM_CATEGORIES } from "../src/lib/categories/catalog";

if (process.env.NODE_ENV === "production") {
  throw new Error("The development seed is disabled in production.");
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the development seed.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const data: Prisma.CategoryCreateManyInput[] = SYSTEM_CATEGORIES.map(
  (category) => ({
    kind: category.kind,
    slug: category.slug,
    labelRu: category.labelRu,
    iconName: category.iconName,
    sortOrder: category.sortOrder,
  }),
);

async function main() {
  const result = await prisma.category.createMany({
    data,
    skipDuplicates: true,
  });

  const total = await prisma.category.count({
    where: { ownerUserId: null },
  });

  console.info(`System categories: ${total}; inserted now: ${result.count}.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
