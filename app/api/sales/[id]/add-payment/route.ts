import { logAction } from "@/app/lib/audit";
import { acquireFinancialLock } from "@/app/lib/financialLock";
import { canVoidOrSettle } from "@/app/lib/permissions";
import { postTrackedPayment } from "@/app/lib/paymentPosting";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  if (!canVoidOrSettle(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const saleId = Number((await params).id);
  const amount = Number((await request.json()).amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  try {
    const payment = await prisma.$transaction(async (tx) => {
      await acquireFinancialLock(tx);
      const sale = await tx.sales.findUnique({ where: { id: saleId } });
      if (!sale) throw new Error("Sale not found.");
      return postTrackedPayment(tx, { date: new Date(), partyType: "customer", partyId: sale.customer_id,
        amount, method: "cash", description: "Payment for " + sale.voucher_no, userId,
        sourcePath: "sale_add_payment", target: { kind: "sale", id: sale.id } });
    }, { maxWait: 15000, timeout: 20000 });
    await logAction(session.userId, "add_payment", "sale", saleId, { amount, payment_id: payment.id });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Payment save nahi ho saka." }, { status: 500 }); }
}
