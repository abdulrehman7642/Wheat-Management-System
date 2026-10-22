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
  const purchaseId = Number((await params).id);
  try {
    const payment = await prisma.$transaction(async (tx) => {
      await acquireFinancialLock(tx);
      const purchase = await tx.purchases.findUnique({ where: { id: purchaseId } });
      if (!purchase || Number(purchase.remaining_amount) <= 0) throw new Error(purchase ? "Already fully paid." : "Purchase not found.");
      return postTrackedPayment(tx, { date: new Date(), partyType: "supplier", partyId: purchase.supplier_id,
        amount: purchase.remaining_amount, method: "cash", description: "Mark paid: " + purchase.voucher_no,
        userId, sourcePath: "purchase_mark_paid", target: { kind: "purchase", id: purchase.id } });
    }, { maxWait: 15000, timeout: 20000 });
    await logAction(session.userId, "mark_paid", "purchase", purchaseId, { payment_id: payment.id });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Mark paid fail ho gaya." }, { status: 500 }); }
}
