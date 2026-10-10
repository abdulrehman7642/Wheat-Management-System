import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const paymentSchema = z.object({
  date: z.string(),
  party_type: z.enum(["supplier", "customer"]),
  party_id: z.number(),
  amount: z.number().positive(),
  method: z.enum(["cash", "bank"]),
  description: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payments = await prisma.payments.findMany({
    orderBy: { id: "desc" },
    take: 50,
  });

  return NextResponse.json(payments);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = paymentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Voucher number: PV for payment to supplier, RV-style also PV per our seed (cash_payment prefix)
        const docType =
          d.method === "cash" ? "cash_payment" : "bank_deposit";
        const docNum = await tx.document_numbering.update({
          where: { doc_type: docType },
          data: { current_number: { increment: 1 } },
        });
        const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

        // 2. Create payment record
        const payment = await tx.payments.create({
          data: {
            voucher_no: voucherNo,
            date: new Date(d.date),
            party_type: d.party_type,
            party_id: d.party_id,
            amount: d.amount,
            method: d.method,
            description: d.description,
            created_by: session.userId,
          },
        });

        // 3. Ledger entry.
        // Paying a SUPPLIER reduces what we owe them -> debit (opposite of purchase credit).
        // Receiving from a CUSTOMER reduces what they owe us -> credit (opposite of sale debit).
        const accountType = d.party_type;
        const lastLedger = await tx.ledger_entries.findFirst({
          where: { account_type: accountType, account_id: d.party_id },
          orderBy: { id: "desc" },
        });
        const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;

        const isSupplier = d.party_type === "supplier";
        const debit = isSupplier ? d.amount : 0;
        const credit = isSupplier ? 0 : d.amount;
        const newBalance = isSupplier
          ? prevBalance - d.amount
          : prevBalance - d.amount;

        const description =
          d.description ||
          `${d.method === "cash" ? "Cash" : "Bank"} ${
            isSupplier ? "Paid" : "Received"
          } - ${voucherNo}`;

        await tx.ledger_entries.create({
          data: {
            date: new Date(d.date),
            account_type: accountType,
            account_id: d.party_id,
            voucher_no: voucherNo,
            description,
            debit,
            credit,
            balance: newBalance,
            ref_type: "payment",
            ref_id: payment.id,
            created_by: session.userId,
          },
        });

        // 4. If supplier: reduce remaining_amount on their oldest unpaid purchases (FIFO settlement)
        // If customer: reduce remaining_amount on their oldest unpaid sales
        let remainingToApply = d.amount;

        if (isSupplier) {
          const openPurchases = await tx.purchases.findMany({
            where: { supplier_id: d.party_id, remaining_amount: { gt: 0 } },
            orderBy: { id: "asc" },
          });
          for (const p of openPurchases) {
            if (remainingToApply <= 0) break;
            const owed = Number(p.remaining_amount);
            const applied = Math.min(owed, remainingToApply);
            await tx.purchases.update({
              where: { id: p.id },
              data: {
                paid_amount: { increment: applied },
                remaining_amount: { decrement: applied },
              },
            });
            remainingToApply -= applied;
          }
        } else {
          const openSales = await tx.sales.findMany({
            where: { customer_id: d.party_id, remaining_amount: { gt: 0 } },
            orderBy: { id: "asc" },
          });
          for (const s of openSales) {
            if (remainingToApply <= 0) break;
            const owed = Number(s.remaining_amount);
            const applied = Math.min(owed, remainingToApply);
            await tx.sales.update({
              where: { id: s.id },
              data: {
                received_amount: { increment: applied },
                remaining_amount: { decrement: applied },
              },
            });
            remainingToApply -= applied;
          }
        }

        return payment;
      },
      { maxWait: 15000, timeout: 20000 }
    );

    await logAction(session.userId, "create", "payment", result.id, result);
return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment save nahi ho saka." },
      { status: 500 }
    );
  }
}