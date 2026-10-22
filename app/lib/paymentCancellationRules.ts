import { Decimal } from "@prisma/client/runtime/client";

// Pure Phase 1 rules only. No Prisma client, environment, clock or database access.
// TRUST BOUNDARY: eligibility evaluates policy against supplied snapshots only.
// These helpers do NOT authenticate users, authorize database actions, establish
// database evidence or prevent races. Client-provided evidence flags are never
// trustworthy. A future server-side transactional service must construct snapshots
// from verified database records under appropriate locks and recheck before posting.
// Isolate precision/rounding from Decimal configuration elsewhere in the ERP.
const Exact = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const MAX_PAYMENT = "999999999999.99"; // numeric(14, 2)
const MAX_BALANCE = "99999999999999.99"; // numeric(16, 2)

export class CancellationRuleError extends Error {
  constructor(public readonly code: string) {
    super(code); // Codes deliberately contain no financial values or personal data.
    this.name = "CancellationRuleError";
  }
}

function requireRule(condition: unknown, code: string): asserts condition {
  if (!condition) throw new CancellationRuleError(code);
}

function money(value: string, signed = false, maximum = MAX_PAYMENT): Decimal {
  requireRule(typeof value === "string" && value.length <= 40 &&
    (signed ? /^-?\d{1,14}(?:\.\d{1,2})?$/ : /^\d{1,14}(?:\.\d{1,2})?$/).test(value), "INVALID_MONEY");
  const result = new Exact(value);
  requireRule(result.abs().lte(maximum), "MONEY_OUT_OF_RANGE");
  return result;
}

function asMoney(value: Decimal, maximum = MAX_PAYMENT): string {
  requireRule(value.isFinite() && value.abs().lte(maximum), "MONEY_OUT_OF_RANGE");
  return value.isZero() ? "0.00" : value.toFixed(2);
}

/** Explicit display/input rounding policy. Stored amounts must NOT use this to hide drift. */
export function roundCancellationMoney(value: string): string {
  requireRule(typeof value === "string" && value.length <= 40 &&
    /^-?\d{1,14}(?:\.\d{1,18})?$/.test(value), "INVALID_MONEY");
  return asMoney(new Exact(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP));
}

function validIntId(value: unknown): boolean {
  return typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) &&
    (value.length < 10 || value <= "2147483647");
}

function validBigIntId(value: unknown): boolean {
  return typeof value === "string" && /^[1-9]\d{0,18}$/.test(value) &&
    (value.length < 19 || value <= "9223372036854775807");
}

function validDate(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Caller supplies a captured server instant; never reads the system clock. */
export function pakistanBusinessDate(instant: Date): string {
  requireRule(instant instanceof Date && Number.isFinite(instant.getTime()), "INVALID_INSTANT");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (name: string) => parts.find(p => p.type === name)?.value;
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  requireRule(validDate(result), "INVALID_INSTANT");
  return result;
}

export type CancellationRequest = Readonly<{
  reason: string;
  idempotencyKey: string;
  intent: "correction";
}>;

/** Reject client amount/date/refund overrides: this operation is full correction only. */
export function validateCancellationRequest(value: unknown): CancellationRequest {
  requireRule(!!value && typeof value === "object" && !Array.isArray(value), "INVALID_REQUEST");
  const input = value as Record<string, unknown>;
  requireRule(Object.keys(input).sort().join(",") === "idempotencyKey,intent,reason", "UNSUPPORTED_REQUEST_FIELDS");
  requireRule(input.intent === "correction", "REFUND_NOT_SUPPORTED");
  requireRule(typeof input.reason === "string", "INVALID_REASON");
  const reason = input.reason.trim();
  requireRule(reason.length > 0 && reason.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(reason), "INVALID_REASON");
  requireRule(typeof input.idempotencyKey === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey), "INVALID_IDEMPOTENCY_KEY");
  return { reason, idempotencyKey: input.idempotencyKey.toLowerCase(), intent: "correction" };
}

export type CancellationIdentity = Readonly<{
  paymentId: string;
  actorId: string;
  request: CancellationRequest;
}>;
export type ExistingCancellation = CancellationIdentity & Readonly<{ reversalId: string }>;

/** Policy only: later service must look up BOTH key and payment under locks and
 * enforce database uniqueness. A "new" result grants no permission to write. */
export function cancellationIdempotency(
  current: CancellationIdentity,
  byKey: ExistingCancellation | null,
  byPayment: ExistingCancellation | null,
): { action: "new" } | { action: "replay"; reversalId: string } | { action: "conflict"; code: string } {
  requireRule(validIntId(current.paymentId) && validIntId(current.actorId), "INVALID_ID");
  const request = validateCancellationRequest(current.request);
  if (!byKey && !byPayment) return { action: "new" };
  if (byKey && byPayment && byKey.reversalId === byPayment.reversalId && validBigIntId(byKey.reversalId) &&
    [byKey, byPayment].every(record => record.paymentId === current.paymentId && record.actorId === current.actorId &&
      record.request.idempotencyKey === request.idempotencyKey && record.request.reason === request.reason &&
      record.request.intent === "correction")) return { action: "replay", reversalId: byKey.reversalId };
  return { action: "conflict", code: byKey ? "IDEMPOTENCY_CONFLICT" : "ALREADY_CANCELLED" };
}

export type PartyType = "supplier" | "customer";
export type InvoiceSnapshot = Readonly<{
  id: string;
  kind: "purchase" | "sale";
  partyId: string;
  date: string;
  status: string;
  lineage: "original" | "unsupported";
  total: string;
  settled: string;
  remaining: string;
}>;
export type AllocationSnapshot = Readonly<{
  id: string;
  paymentId: string;
  amount: string;
  trackingVersion: number | null;
  alreadyReversed: boolean;
  invoice: InvoiceSnapshot;
}>;
export type PaymentSnapshot = Readonly<{
  id: string;
  partyId: string;
  partyType: PartyType;
  method: "cash" | "bank";
  status: string;
  date: string;
  amount: string;
  trackingVersion: number | null;
  originalLedgerVerified: boolean;
  allocatedAmount: string;
  advanceAmount: string;
  alreadyCancelled: boolean;
  bankReconciliation: "unknown" | "reconciled" | "unreconciled";
  bankEvidenceVerified: boolean;
}>;

export type CancellationPlan = Readonly<{
  amount: string;
  advanceReversed: string;
  ledger: { debit: string; credit: string; balanceBefore: string; balanceAfter: string };
  book: { method: "cash" | "bank"; in: string; out: string };
  allocations: ReadonlyArray<{ allocationId: string; invoiceId: string; kind: "purchase" | "sale";
    amount: string; settledAfter: string; remainingAfter: string }>;
}>;

/** Full reversal arithmetic for exact stored amounts; never permission to post a
 * reversal. Does not authenticate, check periods or establish bank eligibility.
 * Does not modify inputs or any other payment. See the module trust boundary. */
export function calculatePaymentCancellation(
  payment: PaymentSnapshot, allocations: readonly AllocationSnapshot[], latestBalance: string,
): CancellationPlan {
  requireRule(validIntId(payment.id) && validIntId(payment.partyId), "INVALID_ID");
  requireRule(payment.partyType === "supplier" || payment.partyType === "customer", "INVALID_PARTY_TYPE");
  requireRule(payment.method === "cash" || payment.method === "bank", "INVALID_METHOD");
  requireRule(payment.trackingVersion === 1 && payment.originalLedgerVerified === true, "LEGACY_OR_UNVERIFIED_PAYMENT");
  requireRule(payment.status === "confirmed", "UNSUPPORTED_PAYMENT_STATUS");
  requireRule(payment.alreadyCancelled === false, "ALREADY_CANCELLED");
  // Cash carries explicit false when no bank evidence applies. No malformed flag
  // is accepted, even for cash; bank eligibility separately requires literal true.
  requireRule(typeof payment.bankEvidenceVerified === "boolean", "INVALID_BANK_EVIDENCE");
  requireRule(allocations.length <= 10000, "TOO_MANY_ALLOCATIONS");
  const amount = money(payment.amount);
  requireRule(amount.gt(0), "INVALID_PAYMENT_AMOUNT");
  const advance = money(payment.advanceAmount);
  const recordedAllocated = money(payment.allocatedAmount);
  const before = money(latestBalance, true, MAX_BALANCE);
  let sum = new Exact(0);
  const ids = new Set<string>();
  const invoices = new Set<string>();
  const updates = allocations.map(allocation => {
    const invoice = allocation.invoice;
    requireRule(validIntId(allocation.id) && validIntId(allocation.paymentId) &&
      validIntId(invoice.id) && validIntId(invoice.partyId), "INVALID_ID");
    requireRule(!ids.has(allocation.id), "DUPLICATE_ALLOCATION"); ids.add(allocation.id);
    const target = `${invoice.kind}:${invoice.id}`;
    requireRule(!invoices.has(target), "DUPLICATE_INVOICE_ALLOCATION"); invoices.add(target);
    requireRule(allocation.paymentId === payment.id && allocation.trackingVersion === 1 && allocation.alreadyReversed === false, "UNVERIFIED_ALLOCATION");
    requireRule(invoice.partyId === payment.partyId && invoice.kind === (payment.partyType === "supplier" ? "purchase" : "sale"), "ALLOCATION_PARTY_MISMATCH");
    requireRule(invoice.status === "confirmed" && invoice.lineage === "original", "UNSUPPORTED_INVOICE_STATE");
    const applied = money(allocation.amount);
    requireRule(applied.gt(0), "INVALID_ALLOCATION_AMOUNT");
    const total = money(invoice.total), settled = money(invoice.settled), remaining = money(invoice.remaining);
    requireRule(settled.plus(remaining).eq(total) && applied.lte(settled), "INCONSISTENT_INVOICE_BALANCES");
    sum = sum.plus(applied);
    return { allocationId: allocation.id, invoiceId: invoice.id, kind: invoice.kind,
      amount: asMoney(applied), settledAfter: asMoney(settled.minus(applied)), remainingAfter: asMoney(remaining.plus(applied)) };
  });
  requireRule(sum.eq(recordedAllocated) && sum.plus(advance).eq(amount), "ALLOCATION_CONSERVATION_FAILED");
  const supplier = payment.partyType === "supplier";
  return { amount: asMoney(amount), advanceReversed: asMoney(advance),
    ledger: { debit: supplier ? "0.00" : asMoney(amount), credit: supplier ? asMoney(amount) : "0.00",
      balanceBefore: asMoney(before, MAX_BALANCE), balanceAfter: asMoney(before.plus(amount), MAX_BALANCE) },
    book: { method: payment.method, in: supplier ? asMoney(amount) : "0.00", out: supplier ? "0.00" : asMoney(amount) },
    allocations: updates };
}

export type AccountingPeriod = Readonly<{ startsOn: string; endsOn: string; status: "open" | "closed" }>;

export function assertOpenCancellationPeriods(periods: readonly AccountingPeriod[], dates: readonly string[]): void {
  requireRule(periods.length > 0 && periods.length <= 10000 && dates.length > 0, "PERIOD_COVERAGE_MISSING");
  const ordered = [...periods].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  for (let i = 0; i < ordered.length; i++) {
    const period = ordered[i];
    requireRule(validDate(period.startsOn) && validDate(period.endsOn) && period.startsOn <= period.endsOn &&
      ["open", "closed"].includes(period.status), "INVALID_ACCOUNTING_PERIOD");
    requireRule(i === 0 || ordered[i - 1].endsOn < period.startsOn, "OVERLAPPING_ACCOUNTING_PERIODS");
  }
  for (const date of dates) {
    requireRule(validDate(date), "INVALID_BUSINESS_DATE");
    const period = ordered.find(p => p.startsOn <= date && p.endsOn >= date);
    requireRule(period, "PERIOD_COVERAGE_MISSING");
    requireRule(period.status === "open", "ACCOUNTING_PERIOD_CLOSED");
  }
}

/** Policy against supplied snapshots only. "eligible" does NOT authenticate or
 * authorize a user, establish trusted database evidence, or prevent races. Never
 * populate this input from client-supplied evidence. The future transactional
 * service must verify records and recheck under locks before any financial write. */
export function evaluateCancellationEligibility(input: Readonly<{
  actor: { id: string; role: string; active: boolean };
  request: unknown;
  serverInstant: Date;
  periodsConfigured: boolean;
  periods: readonly AccountingPeriod[];
  payment: PaymentSnapshot;
  allocations: readonly AllocationSnapshot[];
  latestBalance: string;
}>): { eligible: true; effectiveDate: string; request: CancellationRequest; plan: CancellationPlan } |
  { eligible: false; code: string } {
  try {
    requireRule(validIntId(input.actor.id) && input.actor.active === true && input.actor.role === "owner", "OWNER_REQUIRED");
    const request = validateCancellationRequest(input.request);
    const effectiveDate = pakistanBusinessDate(input.serverInstant);
    requireRule(input.periodsConfigured === true, "PERIODS_NOT_CONFIGURED");
    assertOpenCancellationPeriods(input.periods, [effectiveDate, input.payment.date, ...input.allocations.map(a => a.invoice.date)]);
    if (input.payment.method === "bank") requireRule(input.payment.bankReconciliation === "unreconciled" &&
      input.payment.bankEvidenceVerified === true, "BANK_CANCELLATION_BLOCKED");
    const plan = calculatePaymentCancellation(input.payment, input.allocations, input.latestBalance);
    return { eligible: true, effectiveDate, request, plan };
  } catch (error) {
    if (error instanceof CancellationRuleError) return { eligible: false, code: error.code };
    throw error; // Programming errors must not be disguised as ordinary ineligibility.
  }
}
