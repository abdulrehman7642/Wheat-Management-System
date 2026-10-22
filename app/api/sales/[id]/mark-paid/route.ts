import { logAction } from "@/app/lib/audit";
import { acquireFinancialLock } from "@/app/lib/financialLock";
import { canVoidOrSettle } from "@/app/lib/permissions";
import { postTrackedPayment } from "@/app/lib/paymentPosting";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { NextResponse } from "next/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  if (!canVoidOrSettle(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const saleId = Number((await params).id);
  try {
    const payment = await prisma.$transaction(async (tx) => {
      await acquireFinancialLock(tx);
      const sale = await tx.sales.findUnique({ where: { id: saleId } });
      if (!sale || Number(sale.remaining_amount) <= 0) throw new Error(sale ? "Already fully received." : "Sale not found.");
      return postTrackedPayment(tx, { date: new Date(), partyType: "customer", partyId: sale.customer_id,
        amount: sale.remaining_amount, method: "cash", description: "Mark paid: " + sale.voucher_no,
        userId, sourcePath: "sale_mark_paid", target: { kind: "sale", id: sale.id } });
    }, { maxWait: 15000, timeout: 20000 });
    await logAction(session.userId, "mark_paid", "sale", saleId, { payment_id: payment.id });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Mark paid fail ho gaya." }, { status: 500 }); }
}
