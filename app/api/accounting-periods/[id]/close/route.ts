import { acquireFinancialLock } from "@/app/lib/financialLock";
import { isOwner } from "@/app/lib/permissions";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  if (!isOwner(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = Number((await params).id);
  try { const period = await prisma.$transaction(async tx => { await acquireFinancialLock(tx);
    const actor = await tx.users.findUnique({ where: { id: userId }, include: { roles: true } });
    if (!actor || actor.status !== "active" || actor.roles.name !== "owner") throw new Error("OWNER_REQUIRED");
    const row = await tx.accounting_periods.update({ where: { id, status: "open" }, data: { status: "closed", closed_at: new Date(), closed_by: userId } });
    await tx.audit_logs.create({ data: { user_id: userId, action: "close", record_type: "accounting_period", record_id: id } }); return row; });
    return NextResponse.json(period);
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_REQUIRED") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Accounting period cannot be closed." }, { status: 409 });
  }
}
