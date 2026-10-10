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
  const purchaseId = parseInt(id);

  try {
    await prisma.$transaction(
      async (tx) => {
        const purchase = await tx.purchases.findUnique({ where: { id: purchaseId } });
        if (!purchase) throw new Error("Purchase not found.");
        if (purchase.status === "voided") throw new Error("Already voided.");

        // Reverse inventory: remove the net weight that was added
        const lastInv = await tx.inventory_transactions.findFirst({
          where: { wheat_type_id: purchase.wheat_type_id },
          orderBy: { id: "desc" },
        });
        const prevStock = lastInv ? Number(lastInv.balance_kg) : 0;
        const netWeight = Number(purchase.net_weight_kg);

        await tx.inventory_transactions.create({
          data: {
            date: new Date(),
            wheat_type_id: purchase.wheat_type_id,
            ref_type: "purchase",
            ref_id: purchase.id,
            out_qty_kg: netWeight,
            balance_kg: prevStock - netWeight,
            reason: "Voided purchase " + purchase.voucher_no,
            created_by: session.userId,
          },
        });

        // Reverse ledger: opposite entry (debit instead of credit)
        const lastLedger = await tx.ledger_entries.findFirst({
          where: { account_type: "supplier", account_id: purchase.supplier_id },
          orderBy: { id: "desc" },
        });
        const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;
        const totalAmount = Number(purchase.total_amount);

        await tx.ledger_entries.create({
          data: {
            date: new Date(),
            account_type: "supplier",
            account_id: purchase.supplier_id,
            voucher_no: "VOID-" + purchase.voucher_no,
            description: "Entry Reversed: " + purchase.voucher_no,
            debit: totalAmount,
            credit: 0,
            balance: prevBalance - totalAmount,
            ref_type: "journal",
            ref_id: purchase.id,
            created_by: session.userId,
          },
        });

        await tx.purchases.update({
          where: { id: purchaseId },
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