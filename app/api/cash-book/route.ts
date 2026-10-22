import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payments = await prisma.payments.findMany({
    where: { method: "cash" },
    include: { payment_reversal: true },
    orderBy: { id: "asc" },
  });

  let balance = 0;
  const entries = payments.flatMap(p => [{ payment: p, reversal: false, date: p.date, id: `p-${p.id}` },
    ...(p.payment_reversal ? [{ payment: p, reversal: true, date: p.payment_reversal.effective_date, id: `r-${p.payment_reversal.id}` }] : [])])
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
  const rows = entries.map(({ payment: p, reversal, date, id }) => {
    const isSupplierPayment = p.party_type === "supplier";
    // Paying a supplier = cash OUT. Receiving from a customer = cash IN.
    const out = reversal ? (isSupplierPayment ? 0 : Number(p.amount)) : (isSupplierPayment ? Number(p.amount) : 0);
    const inAmt = reversal ? (isSupplierPayment ? Number(p.amount) : 0) : (isSupplierPayment ? 0 : Number(p.amount));
    balance += inAmt - out;

    return {
      id,
      voucher_no: reversal ? p.payment_reversal!.voucher_no : p.voucher_no,
      date,
      description:
        (reversal ? `Cancellation of ${p.voucher_no}` : p.description) ||
        `${isSupplierPayment ? "Payment to supplier" : "Received from customer"}`,
      in: inAmt,
      out,
      balance,
    };
  });

  return NextResponse.json(rows);
}
