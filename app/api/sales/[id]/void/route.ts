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

  try {
    await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sales.findUnique({ where: { id: saleId } });
        if (!sale) throw new Error("Sale not found.");
        if (sale.status === "voided") throw new Error("Already voided.");

        const lastInv = await tx.inventory_transactions.findFirst({
          where: { wheat_type_id: sale.wheat_type_id },
          orderBy: { id: "desc" },
        });
        const prevStock = lastInv ? Number(lastInv.balance_kg) : 0;
        const netWeight = Number(sale.net_weight_kg);

        await tx.inventory_transactions.create({
          data: {
            date: new Date(),
            wheat_type_id: sale.wheat_type_id,
            ref_type: "sale",
            ref_id: sale.id,
            in_qty_kg: netWeight,
            balance_kg: prevStock + netWeight,
            reason: "Voided sale " + sale.voucher_no,
            created_by: session.userId,
          },
        });

        const lastLedger = await tx.ledger_entries.findFirst({
          where: { account_type: "customer", account_id: sale.customer_id },
          orderBy: { id: "desc" },
        });
        const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;
        const totalAmount = Number(sale.total_amount);

        await tx.ledger_entries.create({
          data: {
            date: new Date(),
            account_type: "customer",
            account_id: sale.customer_id,
            voucher_no: "VOID-" + sale.voucher_no,
            description: "Entry Reversed: " + sale.voucher_no,
            debit: 0,
            credit: totalAmount,
            balance: prevBalance - totalAmount,
            ref_type: "journal",
            ref_id: sale.id,
            created_by: session.userId,
          },
        });

        await tx.sales.update({
          where: { id: saleId },
          data: { status: "voided", void_reason: "Voided by user" },
        });
      },
      { maxWait: 15000, timeout: 20000 }
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Void fail ho gaya." },
      { status: 500 }
    );
  }
}