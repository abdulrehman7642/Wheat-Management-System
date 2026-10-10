import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const schema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const user = await prisma.users.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(parsed.data.current_password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Current password galat hai." }, { status: 400 });
  }

  const newHash = await bcrypt.hash(parsed.data.new_password, 10);

  await prisma.users.update({
    where: { id: session.userId },
    data: { password_hash: newHash },
  });

  return NextResponse.json({ success: true });
}