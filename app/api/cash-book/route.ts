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
    orderBy: { id: "asc" },
  });

  let balance = 0;
  const rows = payments.map((p) => {
    const isSupplierPayment = p.party_type === "supplier";
    // Paying a supplier = cash OUT. Receiving from a customer = cash IN.
    const out = isSupplierPayment ? Number(p.amount) : 0;
    const inAmt = isSupplierPayment ? 0 : Number(p.amount);
    balance += inAmt - out;

    return {
      id: p.id,
      voucher_no: p.voucher_no,
      date: p.date,
      description:
        p.description ||
        `${isSupplierPayment ? "Payment to supplier" : "Received from customer"}`,
      in: inAmt,
      out,
      balance,
    };
  });

  return NextResponse.json(rows);
}