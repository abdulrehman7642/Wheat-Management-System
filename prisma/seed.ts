import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const defaultRoles = ["owner", "accountant", "data_entry"];
  for (const name of defaultRoles) {
    await prisma.roles.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const ownerRole = await prisma.roles.findUnique({ where: { name: "owner" } });
  if (!ownerRole) {
    throw new Error("Failed to find or create owner role.");
  }

  const existing = await prisma.users.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log("Admin user already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash("changeme123", 10);

  await prisma.users.create({
    data: {
      username: "admin",
      password_hash: passwordHash,
      full_name: "Malik Yaseen",
      role_id: ownerRole.id,
      status: "active",
    },
  });

  console.log("Admin user created. Username: admin  Password: changeme123");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());