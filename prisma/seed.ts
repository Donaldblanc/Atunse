import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/features/accounts/password";

// Seeds (or updates) the one bootstrap admin account so the admin panel is
// reachable in local/dev environments. Requires ADMIN_EMAIL/ADMIN_PASSWORD
// in the environment — refuses to run without them rather than seeding a
// guessable default credential.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment to seed the admin account");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const account = await prisma.account.upsert({
    where: { email: email.toLowerCase() },
    update: { passwordHash: hashPassword(password), role: "ADMIN" },
    create: { email: email.toLowerCase(), role: "ADMIN", passwordHash: hashPassword(password) },
  });

  console.log(`Seeded admin account: ${account.email} (${account.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
