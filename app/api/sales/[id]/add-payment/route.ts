import { logAction } from "@/app/lib/audit";
import { canVoidOrSettle } from "@/app/lib/permissions";
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canVoidOrSettle(session)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

  const { id } = await params;
  const saleId = parseInt(id);
  const body = await request.json();
  const amount = Number(body.amount);

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sales.findUnique({ where: { id: saleId } });
        if (!sale) throw new Error("Sale not found.");

        const remaining = Number(sale.remaining_amount);
        if (amount > remaining) {
          throw new Error(`Amount remaining se zyada hai. Remaining: ${remaining}`);
        }

        const docNum = await tx.document_numbering.update({
          where: { doc_type: "cash_payment" },
          data: { current_number: { increment: 1 } },
        });
        const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

        await tx.payments.create({
          data: {
            voucher_no: voucherNo,
            date: new Date(),
            party_type: "customer",
            party_id: sale.customer_id,
            amount: amount,
            method: "cash",
            description: "Payment for " + sale.voucher_no,
            created_by: session.userId,
          },
        });

        const lastLedger = await tx.ledger_entries.findFirst({
          where: { account_type: "customer", account_id: sale.customer_id },
          orderBy: { id: "desc" },
        });
        const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;

        await tx.ledger_entries.create({
          data: {
            date: new Date(),
            account_type: "customer",
            account_id: sale.customer_id,
            voucher_no: voucherNo,
            description: "Cash Received - " + sale.voucher_no,
            debit: 0,
            credit: amount,
            balance: prevBalance - amount,
            ref_type: "payment",
            ref_id: sale.id,
            created_by: session.userId,
          },
        });

        await tx.sales.update({
          where: { id: saleId },
          data: {
            received_amount: { increment: amount },
            remaining_amount: { decrement: amount },
          },
        });
      },
      { maxWait: 15000, timeout: 20000 }
    );
await logAction(session.userId, "add_payment", "sale", saleId, { amount });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment save nahi ho saka." },
      { status: 500 }
    );
  }
}