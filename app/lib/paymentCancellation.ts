import { Decimal } from "@prisma/client/runtime/client";
import { acquireFinancialLock } from "./financialLock";
import type { Tx } from "./purchaseOps";
import { cancellationIdempotency, evaluateCancellationEligibility, validateCancellationRequest } from "./paymentCancellationRules";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export async function cancelPaymentTx(tx: Tx, input: { paymentId: number; actorId: number; request: unknown; serverInstant: Date }) {
  await acquireFinancialLock(tx);
  const request = validateCancellationRequest(input.request);
  const actor = await tx.users.findUnique({ where: { id: input.actorId }, include: { roles: true } });
  if (!actor || actor.status !== "active" || actor.roles.name !== "owner") throw new Error("OWNER_REQUIRED");
  const [byKey, byPayment] = await Promise.all([
    tx.payment_reversals.findUnique({ where: { idempotency_key: request.idempotencyKey } }),
    tx.payment_reversals.findUnique({ where: { original_payment_id: input.paymentId } }),
  ]);
  const identity = (row: NonNullable<typeof byKey>) => ({ paymentId: row.original_payment_id.toString(), actorId: row.created_by.toString(),
    request: { reason: row.reason, idempotencyKey: row.idempotency_key, intent: "correction" as const }, reversalId: row.id.toString() });
  const idem = cancellationIdempotency({ paymentId: input.paymentId.toString(), actorId: input.actorId.toString(), request },
    byKey ? identity(byKey) : null, byPayment ? identity(byPayment) : null);
  if (idem.action === "replay") return byPayment!;
  if (idem.action === "conflict") throw new Error(idem.code);

  const controls = await tx.financial_controls.findUnique({ where: { id: 1 } });
  if (!controls?.payment_cancellation_enabled || !controls.accounting_periods_required) throw new Error("PAYMENT_CANCELLATION_DISABLED");
  const payment = await tx.payments.findUnique({ where: { id: input.paymentId }, include: {
    payment_posting: { include: { original_ledger_entry: true, payment_allocations: { include: { purchase: true, sale: true, allocation_reversal: true } } } },
    payment_reversal: true,
  }});
  if (!payment?.payment_posting || payment.party_id === null) throw new Error("LEGACY_OR_UNVERIFIED_PAYMENT");
  const posting = payment.payment_posting;
  const periods = await tx.accounting_periods.findMany({ orderBy: { start_date: "asc" } });
  const lastLedger = await tx.ledger_entries.findFirst({ where: { account_type: payment.party_type, account_id: payment.party_id }, orderBy: { id: "desc" } });
  const allocationSnapshots = posting.payment_allocations.map(a => {
    const invoice = a.purchase ?? a.sale;
    if (!invoice) throw new Error("UNVERIFIED_ALLOCATION");
    const purchase = a.purchase !== null;
    return { id: a.id.toString(), paymentId: a.payment_id.toString(), amount: a.allocated_amount.toString(),
      trackingVersion: a.tracking_version, alreadyReversed: a.allocation_reversal === null ? false : true,
      invoice: { id: invoice.id.toString(), kind: purchase ? "purchase" as const : "sale" as const,
        partyId: (purchase ? a.purchase!.supplier_id : a.sale!.customer_id).toString(), date: isoDate(invoice.date),
        status: invoice.status, lineage: invoice.status === "confirmed" ? "original" as const : "unsupported" as const,
        total: invoice.total_amount.toString(), settled: (purchase ? a.purchase!.paid_amount : a.sale!.received_amount).toString(),
        remaining: invoice.remaining_amount.toString() } };
  });
  const eligibility = evaluateCancellationEligibility({
    actor: { id: input.actorId.toString(), role: actor?.roles.name ?? "", active: actor?.status === "active" },
    request, serverInstant: input.serverInstant, periodsConfigured: periods.length > 0,
    periods: periods.map(p => ({ startsOn: isoDate(p.start_date), endsOn: isoDate(p.end_date), status: p.status as "open" | "closed" })),
    payment: { id: payment.id.toString(), partyId: payment.party_id.toString(), partyType: payment.party_type as "supplier" | "customer",
      method: payment.method as "cash" | "bank", status: payment.status, date: isoDate(payment.date), amount: payment.amount.toString(),
      trackingVersion: posting.tracking_version, originalLedgerVerified: posting.original_ledger_entry.ref_id === payment.id,
      allocatedAmount: posting.allocated_amount.toString(), advanceAmount: posting.advance_amount.toString(),
      alreadyCancelled: payment.payment_reversal === null ? false : true,
      bankReconciliation: posting.bank_reconciliation_status as "unknown" | "reconciled" | "unreconciled",
      bankEvidenceVerified: false },
    allocations: allocationSnapshots, latestBalance: lastLedger?.balance.toString() ?? "0",
  });
  if (!eligibility.eligible) throw new Error(eligibility.code);
  const datePeriod = (date: string) => periods.find(p => isoDate(p.start_date) <= date && isoDate(p.end_date) >= date && p.status === "open");
  const originalPeriod = datePeriod(isoDate(payment.date));
  const effectivePeriod = datePeriod(eligibility.effectiveDate);
  if (!originalPeriod || !effectivePeriod) throw new Error("PERIOD_COVERAGE_MISSING");

  for (const update of eligibility.plan.allocations) {
    const value = new D(update.amount);
    if (update.kind === "purchase") await tx.purchases.update({ where: { id: Number(update.invoiceId) }, data: {
      paid_amount: new D(update.settledAfter), remaining_amount: new D(update.remainingAfter) } });
    else await tx.sales.update({ where: { id: Number(update.invoiceId) }, data: {
      received_amount: new D(update.settledAfter), remaining_amount: new D(update.remainingAfter) } });
    if (!value.gt(0)) throw new Error("INVALID_ALLOCATION_AMOUNT");
  }
  const counter = await tx.payment_reversal_counters.update({ where: { prefix: "PCR" }, data: { current_number: { increment: 1 }, updated_at: new Date() } });
  const voucherNo = `PCR-${counter.current_number}`;
  const ledger = await tx.ledger_entries.create({ data: {
    date: new Date(eligibility.effectiveDate + "T00:00:00.000Z"), account_type: payment.party_type, account_id: payment.party_id,
    voucher_no: voucherNo, description: `Payment cancellation: ${payment.voucher_no} - ${request.reason}`,
    debit: new D(eligibility.plan.ledger.debit), credit: new D(eligibility.plan.ledger.credit),
    balance: new D(eligibility.plan.ledger.balanceAfter), ref_type: "payment_reversal", ref_id: payment.id, created_by: input.actorId,
  }});
  const reversal = await tx.payment_reversals.create({ data: {
    payment_posting_id: posting.id, original_payment_id: payment.id, reversal_ledger_entry_id: ledger.id,
    voucher_sequence: counter.current_number, voucher_no: voucherNo, idempotency_key: request.idempotencyKey,
    effective_date: new Date(eligibility.effectiveDate + "T00:00:00.000Z"), original_payment_period_id: originalPeriod.id,
    effective_period_id: effectivePeriod.id, reason: request.reason, amount: new D(eligibility.plan.amount),
    reversed_allocated_amount: posting.allocated_amount, reversed_advance_amount: posting.advance_amount, created_by: input.actorId,
  }});
  for (const update of eligibility.plan.allocations) {
    const allocation = posting.payment_allocations.find(a => a.id === Number(update.allocationId))!;
    const invoiceDate = isoDate((allocation.purchase ?? allocation.sale)!.date);
    const period = datePeriod(invoiceDate);
    if (!period) throw new Error("PERIOD_COVERAGE_MISSING");
    await tx.payment_allocation_reversals.create({ data: { payment_reversal_id: reversal.id,
      payment_allocation_id: allocation.id, purchase_id: allocation.purchase_id, sale_id: allocation.sale_id,
      invoice_period_id: period.id, reversed_amount: allocation.allocated_amount } });
  }
  await tx.audit_logs.create({ data: { user_id: input.actorId, action: "cancel_payment", record_type: "payment",
    record_id: payment.id, new_value: { reversal_id: reversal.id.toString(), voucher_no: voucherNo, reason: request.reason } } });
  return reversal;
}
