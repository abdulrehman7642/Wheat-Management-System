import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs = await prisma.audit_logs.findMany({
    orderBy: { id: "desc" },
    take: 100,
  });

  const userIds = [...new Set(logs.map((l) => l.user_id).filter((id): id is number => id !== null))];
  const users = await prisma.users.findMany({ where: { id: { in: userIds } } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.username]));

  const rows = logs.map((l) => ({
    id: Number(l.id),
    user: l.user_id ? userMap[l.user_id] || "Unknown" : "System",
    action: l.action,
    record_type: l.record_type,
    record_id: l.record_id,
    created_at: l.created_at,
  }));

  return NextResponse.json(rows);
}