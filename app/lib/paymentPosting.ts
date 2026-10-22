import { Decimal } from "@prisma/client/runtime/client";
import type { Tx } from "./purchaseOps";
import { acquireFinancialLock } from "./financialLock";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const MAX_PAYMENT = new D("999999999999.99");
type PartyType = "supplier" | "customer";
type Method = "cash" | "bank";
type SourcePath = "standalone_fifo" | "purchase_initial" | "sale_initial" |
  "purchase_add_payment" | "sale_add_payment" | "purchase_mark_paid" | "sale_mark_paid";

export type PaymentTarget = { kind: "purchase" | "sale"; id: number };
export type PostPaymentInput = {
  date: Date; partyType: PartyType; partyId: number; amount: Decimal.Value;
  method: Method; description?: string; userId: number; sourcePath: SourcePath;
  target?: PaymentTarget; fifo?: boolean;
};

function money(value: Decimal.Value) {
  const result = new D(value).toDecimalPlaces(2);
  if (!result.isFinite() || result.lte(0) || result.gt(MAX_PAYMENT) || !result.eq(new D(value))) throw new Error("Invalid payment amount.");
  return result;
}

export async function postTrackedPayment(tx: Tx, input: PostPaymentInput) {
  await acquireFinancialLock(tx);
  const amount = money(input.amount);
  const docType = input.method === "cash" ? "cash_payment" : "bank_deposit";
  const docNum = await tx.document_numbering.update({ where: { doc_type: docType }, data: { current_number: { increment: 1 } } });
  const voucherNo = `${docNum.prefix}-${docNum.current_number}`;
  const payment = await tx.payments.create({ data: {
    voucher_no: voucherNo, date: input.date, party_type: input.partyType, party_id: input.partyId,
    amount, method: input.method, description: input.description, created_by: input.userId,
  }});

  const lastLedger = await tx.ledger_entries.findFirst({
    where: { account_type: input.partyType, account_id: input.partyId }, orderBy: { id: "desc" },
  });
  const previous = new D(lastLedger?.balance?.toString() ?? "0");
  const ledger = await tx.ledger_entries.create({ data: {
    date: input.date, account_type: input.partyType, account_id: input.partyId, voucher_no: voucherNo,
    description: input.description || `${input.method === "cash" ? "Cash" : "Bank"} ${input.partyType === "supplier" ? "Paid" : "Received"}`,
    debit: input.partyType === "supplier" ? amount : new D(0),
    credit: input.partyType === "customer" ? amount : new D(0),
    balance: previous.minus(amount), ref_type: "payment", ref_id: payment.id, created_by: input.userId,
  }});

  const allocations: { kind: "purchase" | "sale"; id: number; amount: InstanceType<typeof D> }[] = [];
  let remaining = amount;
  if (input.target) {
    const invoice = input.target.kind === "purchase"
      ? await tx.purchases.findUnique({ where: { id: input.target.id } })
      : await tx.sales.findUnique({ where: { id: input.target.id } });
    if (!invoice || invoice.status !== "confirmed") throw new Error("Invoice is unavailable for payment.");
    const partyId = input.target.kind === "purchase" ? (invoice as { supplier_id: number }).supplier_id : (invoice as { customer_id: number }).customer_id;
    if (partyId !== input.partyId) throw new Error("Payment party does not match invoice.");
    const open = new D(invoice.remaining_amount.toString());
    if (amount.gt(open)) throw new Error("Payment exceeds invoice remaining amount.");
    allocations.push({ ...input.target, amount });
    remaining = new D(0);
  } else if (input.fifo) {
    const invoices = input.partyType === "supplier"
      ? await tx.purchases.findMany({ where: { supplier_id: input.partyId, status: "confirmed", remaining_amount: { gt: 0 } }, orderBy: { id: "asc" } })
      : await tx.sales.findMany({ where: { customer_id: input.partyId, status: "confirmed", remaining_amount: { gt: 0 } }, orderBy: { id: "asc" } });
    for (const invoice of invoices) {
      if (remaining.isZero()) break;
      const applied = D.min(remaining, new D(invoice.remaining_amount.toString()));
      allocations.push({ kind: input.partyType === "supplier" ? "purchase" : "sale", id: invoice.id, amount: applied });
      remaining = remaining.minus(applied);
    }
  }

  const allocated = amount.minus(remaining);
  const posting = await tx.payment_postings.create({ data: {
    payment_id: payment.id, original_ledger_entry_id: ledger.id, payment_date: input.date,
    party_type: input.partyType, party_id: input.partyId, method: input.method, amount,
    allocated_amount: allocated, advance_amount: remaining, source_path: input.sourcePath,
    tracking_version: 1, bank_reconciliation_status: input.method === "cash" ? "not_applicable" : "unknown",
    created_by: input.userId,
  }});

  for (const allocation of allocations) {
    if (allocation.kind === "purchase") {
      const invoice = await tx.purchases.findUniqueOrThrow({ where: { id: allocation.id } });
      const paid = new D(invoice.paid_amount.toString()).plus(allocation.amount);
      const open = new D(invoice.remaining_amount.toString()).minus(allocation.amount);
      await tx.purchases.update({ where: { id: allocation.id }, data: { paid_amount: paid, remaining_amount: open } });
    } else {
      const invoice = await tx.sales.findUniqueOrThrow({ where: { id: allocation.id } });
      const received = new D(invoice.received_amount.toString()).plus(allocation.amount);
      const open = new D(invoice.remaining_amount.toString()).minus(allocation.amount);
      await tx.sales.update({ where: { id: allocation.id }, data: { received_amount: received, remaining_amount: open } });
    }
    await tx.payment_allocations.create({ data: {
      payment_id: payment.id, ref_type: allocation.kind, ref_id: allocation.id,
      allocated_amount: allocation.amount, payment_posting_id: posting.id,
      purchase_id: allocation.kind === "purchase" ? allocation.id : null,
      sale_id: allocation.kind === "sale" ? allocation.id : null,
      tracking_version: 1, created_at: new Date(),
    }});
  }
  return payment;
}

export async function assertInvoiceHasNoTrackedPayments(tx: Tx, kind: "purchase" | "sale", id: number) {
  await acquireFinancialLock(tx);
  const count = await tx.payment_allocations.count({ where: kind === "purchase" ? { purchase_id: id } : { sale_id: id } });
  if (count > 0) throw new Error("Tracked payments must be cancelled before this invoice can be edited or voided.");
}
