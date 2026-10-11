import { z } from "zod";
import type { Tx } from "./purchaseOps";

export const saleSchema = z.object({
  date: z.string(),
  customer_id: z.number(),
  wheat_type_id: z.number(),
  vehicle_no: z.string().optional(),
  net_weight_kg: z.number(),
  rate_per_maund: z.number(),
  freight_amount: z.number().default(0),
  received_amount: z.number().default(0),
});

export type SaleInput = z.infer<typeof saleSchema>;

export async function createSaleTx(
  tx: Tx,
  d: SaleInput,
  userId: number | undefined,
  carriedReceived?: number
) {
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

  let vehicleId: number | null = null;
  if (d.vehicle_no && d.vehicle_no.trim() !== "") {
    const vehicle = await tx.vehicles.upsert({
      where: { vehicle_no: d.vehicle_no.trim() },
      update: {},
      create: { vehicle_no: d.vehicle_no.trim() },
    });
    vehicleId = vehicle.id;
  }

  const wheatType = await tx.wheat_types.findUnique({
    where: { id: d.wheat_type_id },
    include: { units: true },
  });
  if (!wheatType || !wheatType.units) {
    throw new Error("Wheat type ya uski unit nahi mili.");
  }
  const conversion = Number(wheatType.units.conversion_to_kg);

  const maunds = d.net_weight_kg / conversion;
  const wheatAmount = maunds * d.rate_per_maund;
  const totalAmount = wheatAmount + d.freight_amount;

  const carried = carriedReceived ?? null;
  if (carried === null && d.received_amount > totalAmount) {
    throw new Error("Received amount total se zyada nahi ho sakti.");
  }
  const receivedNow = carried !== null ? Math.min(carried, totalAmount) : d.received_amount;
  const remaining = totalAmount - receivedNow;

  const docNum = await tx.document_numbering.update({
    where: { doc_type: "wheat_sale" },
    data: { current_number: { increment: 1 } },
  });
  const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

  const description = `${wheatType.name} Sold Qty ${d.net_weight_kg} Kgs ${maunds.toFixed(
    2
  )} mounds @ ${d.rate_per_maund} Freight = ${d.freight_amount} on ${d.vehicle_no || "-"}`;

  const sale = await tx.sales.create({
    data: {
      voucher_no: voucherNo,
      date: new Date(d.date),
      customer_id: d.customer_id,
      wheat_type_id: d.wheat_type_id,
      vehicle_id: vehicleId,
      net_weight_kg: d.net_weight_kg,
      maunds: maunds,
      rate_per_maund: d.rate_per_maund,
      wheat_amount: wheatAmount,
      freight_amount: d.freight_amount,
      total_amount: totalAmount,
      received_amount: receivedNow,
      remaining_amount: remaining,
      generated_description: description,
      created_by: userId,
    },
  });

  await tx.inventory_transactions.create({
    data: {
      date: new Date(d.date),
      wheat_type_id: d.wheat_type_id,
      ref_type: "sale",
      ref_id: sale.id,
      out_qty_kg: d.net_weight_kg,
      balance_kg: currentStock - d.net_weight_kg,
      created_by: userId,
    },
  });

  const lastLedger = await tx.ledger_entries.findFirst({
    where: { account_type: "customer", account_id: d.customer_id },
    orderBy: { id: "desc" },
  });
  const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;
  const afterSale = prevBalance + totalAmount;

  await tx.ledger_entries.create({
    data: {
      date: new Date(d.date),
      account_type: "customer",
      account_id: d.customer_id,
      voucher_no: voucherNo,
      description: description,
      debit: totalAmount,
      credit: 0,
      balance: afterSale,
      ref_type: "sale",
      ref_id: sale.id,
      created_by: userId,
    },
  });

  if (carried === null && d.received_amount > 0) {
    const payNum = await tx.document_numbering.update({
      where: { doc_type: "cash_payment" },
      data: { current_number: { increment: 1 } },
    });
    const payVoucher = `${payNum.prefix}-${payNum.current_number}`;

    await tx.payments.create({
      data: {
        voucher_no: payVoucher,
        date: new Date(d.date),
        party_type: "customer",
        party_id: d.customer_id,
        amount: d.received_amount,
        method: "cash",
        description: "Received with " + voucherNo,
        created_by: userId,
      },
    });

    await tx.ledger_entries.create({
      data: {
        date: new Date(d.date),
        account_type: "customer",
        account_id: d.customer_id,
        voucher_no: payVoucher,
        description: "Cash Received - " + voucherNo,
        debit: 0,
        credit: d.received_amount,
        balance: afterSale - d.received_amount,
        ref_type: "payment",
        ref_id: sale.id,
        created_by: userId,
      },
    });
  }

  return sale;
}

export async function voidSaleTx(
  tx: Tx,
  saleId: number,
  userId: number | undefined,
  reason: string
) {
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
      created_by: userId,
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
      created_by: userId,
    },
  });

  await tx.sales.update({
    where: { id: saleId },
    data: { status: "voided", void_reason: reason },
  });

  return sale;
}
