import { PrismaClient } from "@prisma/client";
import { isTestDatabaseName } from "./test-env";

// Vitest setupFiles for integration tests: before any test in a file runs,
// asks Postgres which database the connection really reached and stops the
// file unless it's a *_test one. Backs up the config's TEST_DATABASE_URL
// check for every delete in every file, not just deleteAllOrders.
const prisma = new PrismaClient();
try {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = row?.name ?? "";
  if (!isTestDatabaseName(name)) {
    throw new Error(`Refusing to run integration tests against "${name}": not a *_test database.`);
  }
} finally {
  await prisma.$disconnect();
}
