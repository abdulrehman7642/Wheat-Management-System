import { acquireFinancialLock } from "@/app/lib/financialLock";
import { isOwner } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";
import { z } from "zod";

const periodSchema = z.object({ name: z.string().trim().min(1).max(80), starts_on: z.string().date(), ends_on: z.string().date() });
export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isOwner(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await prisma.accounting_periods.findMany({ orderBy: { start_date: "asc" } }));
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  if (!isOwner(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let parsed; try { parsed = periodSchema.safeParse(await request.json()); } catch { return NextResponse.json({ error: "Invalid data" }, { status: 400 }); }
  if (!parsed.success || parsed.data.starts_on > parsed.data.ends_on) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  try {
    const period = await prisma.$transaction(async tx => { await acquireFinancialLock(tx);
      const actor = await tx.users.findUnique({ where: { id: userId }, include: { roles: true } });
      if (!actor || actor.status !== "active" || actor.roles.name !== "owner") throw new Error("OWNER_REQUIRED");
      const row = await tx.accounting_periods.create({ data: {
      name: parsed.data.name, start_date: new Date(parsed.data.starts_on + "T00:00:00.000Z"), end_date: new Date(parsed.data.ends_on + "T00:00:00.000Z"), created_by: userId } });
      await tx.audit_logs.create({ data: { user_id: userId, action: "create", record_type: "accounting_period", record_id: row.id } }); return row; });
    return NextResponse.json(period);
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_REQUIRED") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Accounting period conflicts with existing configuration." }, { status: 409 });
  }
}
