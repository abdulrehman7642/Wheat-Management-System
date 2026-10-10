import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const saleSchema = z.object({
  date: z.string(),
  customer_id: z.number(),
  wheat_type_id: z.number(),
  vehicle_no: z.string().optional(),
  net_weight_kg: z.number(),
  rate_per_maund: z.number(),
  freight_amount: z.number().default(0),
  received_amount: z.number().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sales = await prisma.sales.findMany({
    include: { customers: true, wheat_types: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(sales);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = saleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check current stock (prevent overselling)
      const lastInv = await tx.inventory_transactions.findFirst({
        where: { wheat_type_id: d.wheat_type_id },
        orderBy: { id: "desc" },
      });
      const currentStock = lastInv ? Number(lastInv.balance_kg) : 0;

      if (d.net_weight_kg > currentStock) {
        throw new Error(
          `Stock kam hai. Available: ${currentStock} KG, Requested: ${d.net_weight_kg} KG`
        );
      }

      // 2. Get wheat type + unit conversion
      const wheatType = await tx.wheat_types.findUnique({
        where: { id: d.wheat_type_id },
        include: { units: true },
      });
      if (!wheatType || !wheatType.units) {
        throw new Error("Wheat type ya uski unit nahi mili.");
      }
      const conversion = Number(wheatType.units.conversion_to_kg);

      // 3. Calculations
      const maunds = d.net_weight_kg / conversion;
      const wheatAmount = maunds * d.rate_per_maund;
      const totalAmount = wheatAmount + d.freight_amount;
      const remaining = totalAmount - d.received_amount;

      // 4. Voucher number
      const docNum = await tx.document_numbering.update({
        where: { doc_type: "wheat_sale" },
        data: { current_number: { increment: 1 } },
      });
      const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

      const description = `${wheatType.name} Sold Qty ${d.net_weight_kg} Kgs ${maunds.toFixed(
        2
      )} mounds @ ${d.rate_per_maund} Freight = ${d.freight_amount} on ${
        d.vehicle_no || "-"
      }`;

      // 5. Create sale
      const sale = await tx.sales.create({
        data: {
          voucher_no: voucherNo,
          date: new Date(d.date),
          customer_id: d.customer_id,
          wheat_type_id: d.wheat_type_id,
          net_weight_kg: d.net_weight_kg,
          maunds: maunds,
          rate_per_maund: d.rate_per_maund,
          wheat_amount: wheatAmount,
          freight_amount: d.freight_amount,
          total_amount: totalAmount,
          received_amount: d.received_amount,
          remaining_amount: remaining,
          generated_description: description,
          created_by: session.userId,
        },
      });

      // 6. Inventory transaction (stock DECREASES)
      await tx.inventory_transactions.create({
        data: {
          date: new Date(d.date),
          wheat_type_id: d.wheat_type_id,
          ref_type: "sale",
          ref_id: sale.id,
          out_qty_kg: d.net_weight_kg,
          balance_kg: currentStock - d.net_weight_kg,
          created_by: session.userId,
        },
      });

      // 7. Ledger entry (customer receivable increases = debit)
      const lastLedger = await tx.ledger_entries.findFirst({
        where: { account_type: "customer", account_id: d.customer_id },
        orderBy: { id: "desc" },
      });
      const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;

      await tx.ledger_entries.create({
        data: {
          date: new Date(d.date),
          account_type: "customer",
          account_id: d.customer_id,
          voucher_no: voucherNo,
          description: description,
          debit: totalAmount,
          credit: 0,
          balance: prevBalance + totalAmount,
          ref_type: "sale",
          ref_id: sale.id,
          created_by: session.userId,
        },
      });

      return sale;
      }, { maxWait: 15000, timeout: 20000
    });

    await logAction(session.userId, "create", "sale", result.id, result);
return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sale save nahi ho saka." },
      { status: 500 }
    );
  }
}