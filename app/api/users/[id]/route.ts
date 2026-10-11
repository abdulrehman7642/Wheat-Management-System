import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { canManageUsers } from "@/app/lib/permissions";
import { logAction } from "@/app/lib/audit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("disable") }),
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("reset_password"), new_password: z.string().min(6) }),
]);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const userId = parseInt(id);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data (password kam az kam 6 huroof)." }, { status: 400 });
  }
  const d = parsed.data;

  const target = await prisma.users.findUnique({
    where: { id: userId },
    include: { roles: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User nahi mila." }, { status: 404 });
  }

  if (d.action === "disable") {
    if (userId === session.userId) {
      return NextResponse.json({ error: "Aap apne aap ko disable nahi kar sakte." }, { status: 400 });
    }
    if (target.roles.name === "owner") {
      const otherOwners = await prisma.users.count({
        where: { id: { not: userId }, status: "active", roles: { is: { name: "owner" } } },
      });
      if (otherOwners === 0) {
        return NextResponse.json({ error: "Aakhri active Owner disable nahi ho sakta." }, { status: 400 });
      }
    }
    await prisma.users.update({ where: { id: userId }, data: { status: "disabled" } });
    await logAction(session.userId, "disable_user", "user", userId);
  } else if (d.action === "enable") {
    await prisma.users.update({ where: { id: userId }, data: { status: "active" } });
    await logAction(session.userId, "enable_user", "user", userId);
  } else {
    const hash = await bcrypt.hash(d.new_password, 10);
    await prisma.users.update({ where: { id: userId }, data: { password_hash: hash } });
    await logAction(session.userId, "reset_password", "user", userId);
  }

  return NextResponse.json({ success: true });
}