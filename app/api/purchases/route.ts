import { logAction } from "@/app/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

const purchaseSchema = z.object({
  date: z.string(),
  supplier_id: z.number(),
  wheat_type_id: z.number(),
  vehicle_no: z.string().optional(),
  bag_count: z.number().default(0),
  gross_weight_kg: z.number(),
  bags_weight_kg: z.number().default(0),
  extra_weight_kg: z.number().default(0),
  rate_per_maund: z.number(),
  wheat_tax_amount: z.number().default(0),
  kanta_charges: z.number().default(0),
  unloading_charges: z.number().default(0),
  bags_amount: z.number().default(0),
  paid_amount: z.number().default(0),
});

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purchases = await prisma.purchases.findMany({
    include: { suppliers: true, wheat_types: true, vehicles: true },
    orderBy: { id: "desc" },
  });

  return NextResponse.json(purchases);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = purchaseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const d = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create vehicle
      let vehicleId: number | null = null;
      if (d.vehicle_no && d.vehicle_no.trim() !== "") {
        const vehicle = await tx.vehicles.upsert({
          where: { vehicle_no: d.vehicle_no.trim() },
          update: {},
          create: { vehicle_no: d.vehicle_no.trim() },
        });
        vehicleId = vehicle.id;
      }

      // 2. Get wheat type + its unit conversion (e.g. Maund = 40 kg)
      const wheatType = await tx.wheat_types.findUnique({
        where: { id: d.wheat_type_id },
        include: { units: true },
      });
      if (!wheatType || !wheatType.units) {
        throw new Error("Wheat type ya uski unit nahi mili.");
      }
      const conversion = Number(wheatType.units.conversion_to_kg);

      // 3. Calculations
      const netWeight = d.gross_weight_kg - d.bags_weight_kg + d.extra_weight_kg;
      const maunds = netWeight / conversion;
      const wheatAmount = maunds * d.rate_per_maund;
      const totalAmount =
  wheatAmount -
  d.wheat_tax_amount -
  d.kanta_charges -
  d.unloading_charges -
  d.bags_amount;
      const remaining = totalAmount - d.paid_amount;

      // 4. Voucher number
      const docNum = await tx.document_numbering.update({
        where: { doc_type: "wheat_purchase" },
        data: { current_number: { increment: 1 } },
      });
      const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

      // 5. Description
      const description = `${wheatType.name} Purchased Qty ${d.bag_count} Bags net Weight ${netWeight} Kgs ${maunds.toFixed(
        2
      )} mounds @ ${d.rate_per_maund} where Gross Weight was ${
        d.gross_weight_kg
      } Kgs Less Bags Weight ${d.bags_weight_kg} Kgs. + extra ${
        d.extra_weight_kg
      } Kgs. Less Wheat Tax Amount = ${d.wheat_tax_amount} and Bags Amount = ${
        d.bags_amount
      } on ${d.vehicle_no || "-"} Kanta Charges = ${
        d.kanta_charges
      } Unloading Wheat Charges = ${d.unloading_charges}`;

      // 6. Create purchase
      const purchase = await tx.purchases.create({
        data: {
          voucher_no: voucherNo,
          date: new Date(d.date),
          supplier_id: d.supplier_id,
          wheat_type_id: d.wheat_type_id,
          vehicle_id: vehicleId,
          bag_count: d.bag_count,
          gross_weight_kg: d.gross_weight_kg,
          bags_weight_kg: d.bags_weight_kg,
          extra_weight_kg: d.extra_weight_kg,
          net_weight_kg: netWeight,
          maunds: maunds,
          rate_per_maund: d.rate_per_maund,
          wheat_amount: wheatAmount,
          wheat_tax_amount: d.wheat_tax_amount,
          kanta_charges: d.kanta_charges,
          unloading_charges: d.unloading_charges,
          bags_amount: d.bags_amount,
          total_amount: totalAmount,
          paid_amount: d.paid_amount,
          remaining_amount: remaining,
          generated_description: description,
          created_by: session.userId,
        },
      });

      // 7. Inventory transaction
      const lastInv = await tx.inventory_transactions.findFirst({
        where: { wheat_type_id: d.wheat_type_id },
        orderBy: { id: "desc" },
      });
      const prevStock = lastInv ? Number(lastInv.balance_kg) : 0;

      await tx.inventory_transactions.create({
        data: {
          date: new Date(d.date),
          wheat_type_id: d.wheat_type_id,
          ref_type: "purchase",
          ref_id: purchase.id,
          in_qty_kg: netWeight,
          balance_kg: prevStock + netWeight,
          created_by: session.userId,
        },
      });

      // 8. Ledger entry (supplier payable increases = credit)
      const lastLedger = await tx.ledger_entries.findFirst({
        where: { account_type: "supplier", account_id: d.supplier_id },
        orderBy: { id: "desc" },
      });
      const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;

      await tx.ledger_entries.create({
        data: {
          date: new Date(d.date),
          account_type: "supplier",
          account_id: d.supplier_id,
          voucher_no: voucherNo,
          description: description,
          debit: 0,
          credit: totalAmount,
          balance: prevBalance + totalAmount,
          ref_type: "purchase",
          ref_id: purchase.id,
          created_by: session.userId,
        },
      });

      return purchase;
      }, { maxWait: 15000, timeout: 20000
    });

    await logAction(session.userId, "create", "purchase", result.id, result);
return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purchase save nahi ho saka." },
      { status: 500 }
    );
  }
}