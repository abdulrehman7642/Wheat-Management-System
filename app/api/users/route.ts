import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canManageUsers } from "@/app/lib/permissions";

const userSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  full_name: z.string().optional(),
  role_name: z.enum(["owner", "accountant", "data_entry"]),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    include: { roles: true },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      status: u.status,
      role: u.roles.name,
      last_login_at: u.last_login_at,
    }))
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const d = parsed.data;

  const role = await prisma.roles.findUnique({ where: { name: d.role_name } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 400 });
  }

  const existing = await prisma.users.findUnique({ where: { username: d.username } });
  if (existing) {
    return NextResponse.json({ error: "Username already exists" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(d.password, 10);

  const user = await prisma.users.create({
    data: {
      username: d.username,
      password_hash: passwordHash,
      full_name: d.full_name,
      role_id: role.id,
      status: "active",
    },
  });

  return NextResponse.json({ id: user.id, username: user.username });
}