import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Username aur password dono chahiye." }, { status: 400 });
  }

  const { username, password } = parsed.data;

  const user = await prisma.users.findUnique({
    where: { username },
    include: { roles: true },
  });

  if (!user || user.status !== "active") {
    return NextResponse.json({ error: "Galat username ya password." }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Galat username ya password." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.roleId = user.role_id;
  session.roleName = user.roles.name;
  await session.save();

  await prisma.users.update({
    where: { id: user.id },
    data: { last_login_at: new Date() },
  });

  return NextResponse.json({ success: true });
}