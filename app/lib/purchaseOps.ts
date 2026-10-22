import { z } from "zod";
import { prisma } from "./prisma";
import { acquireFinancialLock } from "./financialLock";
import { assertInvoiceHasNoTrackedPayments, postTrackedPayment } from "./paymentPosting";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const purchaseSchema = z.object({
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

export type PurchaseInput = z.infer<typeof purchaseSchema>;

// carriedPaid: used by Edit. The amount already paid on the old voucher moves
// to the new one without creating a second payment.
export async function createPurchaseTx(
  tx: Tx,
  d: PurchaseInput,
  userId: number | undefined,
  carriedPaid?: number
) {
  await acquireFinancialLock(tx);
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

  const netWeight = d.gross_weight_kg - d.bags_weight_kg + d.extra_weight_kg;
  const maunds = netWeight / conversion;
  const wheatAmount = maunds * d.rate_per_maund;
  const totalAmount =
    wheatAmount - d.wheat_tax_amount - d.kanta_charges - d.unloading_charges - d.bags_amount;

  const carried = carriedPaid ?? null;
  if (carried === null && d.paid_amount > totalAmount) {
    throw new Error("Paid amount total se zyada nahi ho sakti.");
  }
  const paidNow = carried !== null ? Math.min(carried, totalAmount) : 0;
  const remaining = totalAmount - paidNow;

  const docNum = await tx.document_numbering.update({
    where: { doc_type: "wheat_purchase" },
    data: { current_number: { increment: 1 } },
  });
  const voucherNo = `${docNum.prefix}-${docNum.current_number}`;

  const description = `${wheatType.name} Purchased Qty ${d.bag_count} Bags net Weight ${netWeight} Kgs ${maunds.toFixed(
    2
  )} mounds @ ${d.rate_per_maund} where Gross Weight was ${d.gross_weight_kg} Kgs Less Bags Weight ${
    d.bags_weight_kg
  } Kgs. + extra ${d.extra_weight_kg} Kgs. Less Wheat Tax Amount = ${d.wheat_tax_amount} and Bags Amount = ${
    d.bags_amount
  } on ${d.vehicle_no || "-"} Kanta Charges = ${d.kanta_charges} Unloading Wheat Charges = ${d.unloading_charges}`;

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
      paid_amount: paidNow,
      remaining_amount: remaining,
      generated_description: description,
      created_by: userId,
    },
  });

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
      created_by: userId,
    },
  });

  const lastLedger = await tx.ledger_entries.findFirst({
    where: { account_type: "supplier", account_id: d.supplier_id },
    orderBy: { id: "desc" },
  });
  const prevBalance = lastLedger ? Number(lastLedger.balance) : 0;
  const afterPurchase = prevBalance + totalAmount;

  await tx.ledger_entries.create({
    data: {
      date: new Date(d.date),
      account_type: "supplier",
      account_id: d.supplier_id,
      voucher_no: voucherNo,
      description: description,
      debit: 0,
      credit: totalAmount,
      balance: afterPurchase,
      ref_type: "purchase",
      ref_id: purchase.id,
      created_by: userId,
    },
  });

  if (carried === null && d.paid_amount > 0) {
    if (!userId) throw new Error("Payment creator is required.");
    await postTrackedPayment(tx, { date: new Date(d.date), partyType: "supplier", partyId: d.supplier_id,
      amount: d.paid_amount, method: "cash", description: "Paid with " + voucherNo,
      userId, sourcePath: "purchase_initial", target: { kind: "purchase", id: purchase.id } });
  }

  return d.paid_amount > 0 && carried === null
    ? tx.purchases.findUniqueOrThrow({ where: { id: purchase.id } })
    : purchase;
}

export async function voidPurchaseTx(
  tx: Tx,
  purchaseId: number,
  userId: number | undefined,
  reason: string
) {
  await acquireFinancialLock(tx);
  await assertInvoiceHasNoTrackedPayments(tx, "purchase", purchaseId);
  const purchase = await tx.purchases.findUnique({ where: { id: purchaseId } });
  if (!purchase) throw new Error("Purchase not found.");
  if (purchase.status === "voided") throw new Error("Already voided.");

  const lastInv = await tx.inventory_transactions.findFirst({
    where: { wheat_type_id: purchase.wheat_type_id },
    orderBy: { id: "desc" },
  });
  const prevStock = lastInv ? Number(lastInv.balance_kg) : 0;
  const netWeight = Number(purchase.net_weight_kg);

  if (prevStock - netWeight < 0) {
    throw new Error(
      "Is purchase ki kuch wheat bik chuki hai, isliye ye cancel/edit nahi ho sakti. Pehle related sale dekhein."
    );
  }

  await tx.inventory_transactions.create({
    data: {
      date: new Date(),
      wheat_type_id: purchase.wheat_type_id,
      ref_type: "purchase",
      ref_id: purchase.id,
      out_qty_kg: netWeight,
      balance_kg: prevStock - netWeight,
      reason: "Voided purchase " + purchase.voucher_no,
      created_by: userId,
    },
  });

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
      created_by: userId,
    },
  });

  await tx.purchases.update({
    where: { id: purchaseId },
    data: { status: "voided", void_reason: reason },
  });

  return purchase;
}
