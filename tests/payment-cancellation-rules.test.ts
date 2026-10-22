import assert from "node:assert/strict";
import { test } from "node:test";
import { Decimal } from "@prisma/client/runtime/client";
import {
  assertOpenCancellationPeriods, calculatePaymentCancellation, cancellationIdempotency,
  CancellationRuleError, evaluateCancellationEligibility, pakistanBusinessDate,
  roundCancellationMoney, validateCancellationRequest,
  type AccountingPeriod, type AllocationSnapshot, type PaymentSnapshot,
} from "../app/lib/paymentCancellationRules";

const request = { reason: "Duplicate entry", idempotencyKey: "12345678-1234-4234-8234-123456789abc", intent: "correction" } as const;
const payment: PaymentSnapshot = {
  id: "7", partyId: "3", partyType: "supplier", method: "cash", status: "confirmed",
  date: "2026-10-01", amount: "100.00", trackingVersion: 1, originalLedgerVerified: true,
  allocatedAmount: "80.00", advanceAmount: "20.00", alreadyCancelled: false,
  bankReconciliation: "unknown", bankEvidenceVerified: false,
};
const allocation: AllocationSnapshot = {
  id: "9", paymentId: "7", amount: "80.00", trackingVersion: 1, alreadyReversed: false,
  invoice: { id: "4", kind: "purchase", partyId: "3", date: "2026-09-20", status: "confirmed", lineage: "original",
    total: "200.00", settled: "130.00", remaining: "70.00" },
};
const periods = [{ startsOn: "2026-09-01", endsOn: "2026-10-31", status: "open" as const }];
function context() {
  return { actor: { id: "1", role: "owner", active: true }, request, serverInstant: new Date("2026-10-20T12:00:00Z"),
    periodsConfigured: true, periods: [...periods] as AccountingPeriod[], payment: { ...payment }, allocations: [{ ...allocation, invoice: { ...allocation.invoice } }], latestBalance: "-120.00" };
}
function throwsCode(fn: () => unknown, code: string) {
  assert.throws(fn, (error: unknown) => error instanceof CancellationRuleError && error.code === code);
}
function blocked(input: ReturnType<typeof context>, code: string) {
  assert.deepEqual(evaluateCancellationEligibility(input), { eligible: false, code });
}

test("supplier reversal preserves negative balances, legacy settlement and original inputs", () => {
  const input = context(); const snapshot = JSON.stringify(input);
  Object.freeze(input.payment); Object.freeze(input.allocations[0].invoice); Object.freeze(input.allocations[0]); Object.freeze(input.allocations);
  const result = evaluateCancellationEligibility(input);
  assert.equal(result.eligible, true);
  if (!result.eligible) return;
  assert.equal(result.effectiveDate, "2026-10-20");
  assert.deepEqual(result.plan.ledger, { debit: "0.00", credit: "100.00", balanceBefore: "-120.00", balanceAfter: "-20.00" });
  assert.deepEqual(result.plan.book, { method: "cash", in: "100.00", out: "0.00" });
  assert.equal(result.plan.allocations[0].settledAfter, "50.00"); // Other payments' 50 remain intact.
  assert.equal(result.plan.allocations[0].remainingAfter, "150.00");
  assert.equal(result.plan.advanceReversed, "20.00");
  assert.equal(JSON.stringify(input), snapshot);
});

test("customer receipt reversal uses debit and outflow without changing invoice totals", () => {
  const input = context(); input.payment.partyType = "customer"; input.allocations[0].invoice.kind = "sale";
  const result = evaluateCancellationEligibility(input);
  assert.ok(result.eligible);
  assert.deepEqual(result.plan.ledger, { debit: "100.00", credit: "0.00", balanceBefore: "-120.00", balanceAfter: "-20.00" });
  assert.deepEqual(result.plan.book, { method: "cash", in: "0.00", out: "100.00" });
  assert.equal(result.plan.allocations[0].settledAfter, "50.00");
});

test("full advances reverse with zero invented invoice allocations", () => {
  const p = { ...payment, allocatedAmount: "0", advanceAmount: "100" };
  const plan = calculatePaymentCancellation(p, [], "-100.00");
  assert.deepEqual(plan.allocations, []); assert.equal(plan.ledger.balanceAfter, "0.00");
  assert.equal(plan.advanceReversed, "100.00");
});

test("fractional multi-invoice allocations conserve cents exactly", () => {
  const p = { ...payment, amount: "0.30", allocatedAmount: "0.30", advanceAmount: "0" };
  const allocations = ["0.10", "0.20"].map((amount, i) => ({ ...allocation, id: String(i + 1), amount,
    invoice: { ...allocation.invoice, id: String(i + 10), total: amount, settled: amount, remaining: "0" } }));
  const plan = calculatePaymentCancellation(p, allocations, "0.10");
  assert.equal(plan.ledger.balanceAfter, "0.40");
  assert.deepEqual(plan.allocations.map(a => a.remainingAfter), ["0.10", "0.20"]);
});

test("explicit half-up rounding, negative ties and carry are deterministic", () => {
  assert.equal(roundCancellationMoney("1.005"), "1.01");
  assert.equal(roundCancellationMoney("-1.005"), "-1.01");
  assert.equal(roundCancellationMoney("999.995"), "1000.00");
  assert.equal(roundCancellationMoney("-0.001"), "0.00");
});

test("stored money rejects rounding drift, nonfinite, scientific notation and numbers", () => {
  for (const value of ["100.001", "NaN", "Infinity", "1e2", " 100", 100]) {
    throwsCode(() => calculatePaymentCancellation({ ...payment, amount: value as string }, [allocation], "0"), "INVALID_MONEY");
  }
  throwsCode(() => roundCancellationMoney("999999999999.995"), "MONEY_OUT_OF_RANGE");
});

test("isolated Decimal precision ignores external global configuration", () => {
  const old = Decimal.precision;
  try {
    Decimal.set({ precision: 3 });
    const plan = calculatePaymentCancellation(payment, [allocation], "99999999999800.01");
    assert.equal(plan.ledger.balanceAfter, "99999999999900.01");
  } finally { Decimal.set({ precision: old }); }
});

test("database monetary limits and overflow fail rather than truncate", () => {
  throwsCode(() => calculatePaymentCancellation({ ...payment, amount: "1000000000000.00" }, [allocation], "0"), "MONEY_OUT_OF_RANGE");
  throwsCode(() => calculatePaymentCancellation(payment, [allocation], "99999999999999.99"), "MONEY_OUT_OF_RANGE");
});

test("allocation conservation, duplicates, wrong party and negative settlement are rejected", () => {
  throwsCode(() => calculatePaymentCancellation({ ...payment, advanceAmount: "19.99" }, [allocation], "0"), "ALLOCATION_CONSERVATION_FAILED");
  throwsCode(() => calculatePaymentCancellation(payment, [], "0"), "ALLOCATION_CONSERVATION_FAILED");
  throwsCode(() => calculatePaymentCancellation(payment, [allocation, allocation], "0"), "DUPLICATE_ALLOCATION");
  throwsCode(() => calculatePaymentCancellation(payment, [allocation, { ...allocation, id: "10" }], "0"), "DUPLICATE_INVOICE_ALLOCATION");
  throwsCode(() => calculatePaymentCancellation(payment, [{ ...allocation, invoice: { ...allocation.invoice, partyId: "99" } }], "0"), "ALLOCATION_PARTY_MISMATCH");
  throwsCode(() => calculatePaymentCancellation(payment, [{ ...allocation, invoice: { ...allocation.invoice, settled: "70", remaining: "130" } }], "0"), "INCONSISTENT_INVOICE_BALANCES");
  throwsCode(() => calculatePaymentCancellation(payment, [{ ...allocation, amount: "-1" }], "0"), "INVALID_MONEY");
  throwsCode(() => calculatePaymentCancellation(payment, [{ ...allocation, paymentId: "99" }], "0"), "UNVERIFIED_ALLOCATION");
});

test("all legacy payments, including apparent advances, require verified provenance", () => {
  for (const changes of [{ trackingVersion: null }, { trackingVersion: 2 }, { originalLedgerVerified: false }]) {
    const input = context(); Object.assign(input.payment, changes); blocked(input, "LEGACY_OR_UNVERIFIED_PAYMENT");
  }
  const input = context(); input.payment.trackingVersion = null;
  input.payment.allocatedAmount = "0"; input.payment.advanceAmount = "100"; input.allocations = [];
  blocked(input, "LEGACY_OR_UNVERIFIED_PAYMENT");
});

test("voided, unsupported edited invoices and already reversed allocations are blocked", () => {
  const voided = context(); voided.allocations[0].invoice.status = "voided"; blocked(voided, "UNSUPPORTED_INVOICE_STATE");
  const edited = context(); edited.allocations[0].invoice.lineage = "unsupported"; blocked(edited, "UNSUPPORTED_INVOICE_STATE");
  const reversed = context(); reversed.allocations[0].alreadyReversed = true; blocked(reversed, "UNVERIFIED_ALLOCATION");
  const cancelled = context(); cancelled.payment.alreadyCancelled = true; blocked(cancelled, "ALREADY_CANCELLED");
});

test("Owner must be active; accountants, data entry and missing roles are blocked", () => {
  for (const role of ["accountant", "data_entry", "", "OWNER"]) {
    const input = context(); input.actor.role = role; blocked(input, "OWNER_REQUIRED");
  }
  const input = context(); input.actor.active = false; blocked(input, "OWNER_REQUIRED");
});

test("bank status is fail-closed; only verified unreconciled evidence can pass", () => {
  for (const state of ["unknown", "reconciled", "unreconciled"] as const) {
    const input = context(); input.payment.method = "bank"; input.payment.bankReconciliation = state;
    blocked(input, "BANK_CANCELLATION_BLOCKED");
    input.payment.bankEvidenceVerified = true;
    if (state === "unreconciled") assert.equal(evaluateCancellationEligibility(input).eligible, true);
    else blocked(input, "BANK_CANCELLATION_BLOCKED");
  }
});

test("closed original payment, invoice or current business date blocks cancellation", () => {
  for (const target of ["payment", "invoice", "today"]) {
    const input = context();
    input.periods = [
      { startsOn: "2026-09-01", endsOn: "2026-10-19", status: target === "today" ? "open" : "closed" },
      { startsOn: "2026-10-20", endsOn: "2026-10-31", status: target === "today" ? "closed" : "open" },
    ];
    if (target === "payment") input.allocations[0].invoice.date = "2026-10-20";
    if (target === "invoice") input.payment.date = "2026-10-20";
    blocked(input, "ACCOUNTING_PERIOD_CLOSED");
  }
});

test("unconfigured calendars, gaps, overlap and invalid dates fail closed", () => {
  const input = context(); input.periodsConfigured = false; blocked(input, "PERIODS_NOT_CONFIGURED");
  input.periodsConfigured = true; input.periods = []; blocked(input, "PERIOD_COVERAGE_MISSING");
  throwsCode(() => assertOpenCancellationPeriods([...periods, ...periods], ["2026-10-01"]), "OVERLAPPING_ACCOUNTING_PERIODS");
  throwsCode(() => assertOpenCancellationPeriods(periods, ["2026-02-30"]), "INVALID_BUSINESS_DATE");
  throwsCode(() => assertOpenCancellationPeriods(periods, ["2026-11-01"]), "PERIOD_COVERAGE_MISSING");
  throwsCode(() => assertOpenCancellationPeriods([{ startsOn: "2026-10-31", endsOn: "2026-10-01", status: "open" }], ["2026-10-20"]), "INVALID_ACCOUNTING_PERIOD");
});

test("Pakistan date crosses midnight at 19:00 UTC, including year and leap-day boundaries", () => {
  assert.equal(pakistanBusinessDate(new Date("2026-10-20T18:59:59.999Z")), "2026-10-20");
  assert.equal(pakistanBusinessDate(new Date("2026-10-20T19:00:00Z")), "2026-10-21");
  assert.equal(pakistanBusinessDate(new Date("2026-12-31T19:00:00Z")), "2027-01-01");
  assert.equal(pakistanBusinessDate(new Date("2028-02-28T19:00:00Z")), "2028-02-29");
  throwsCode(() => pakistanBusinessDate(new Date("invalid")), "INVALID_INSTANT");
});

test("request reason mandatory; refunds, amount/date overrides and invalid keys rejected", () => {
  assert.equal(validateCancellationRequest({ ...request, reason: "  Duplicate entry  " }).reason, request.reason);
  for (const reason of ["", "   ", "x".repeat(1001), "bad\u0000reason"]) throwsCode(() => validateCancellationRequest({ ...request, reason }), "INVALID_REASON");
  throwsCode(() => validateCancellationRequest({ ...request, intent: "refund" }), "REFUND_NOT_SUPPORTED");
  for (const overrides of [{ amount: "50" }, { effectiveDate: "2020-01-01" }]) throwsCode(() => validateCancellationRequest({ ...request, ...overrides }), "UNSUPPORTED_REQUEST_FIELDS");
  throwsCode(() => validateCancellationRequest({ ...request, idempotencyKey: "not-a-key" }), "INVALID_IDEMPOTENCY_KEY");
});

test("idempotency permits matching replay only and catches payment/key collisions", () => {
  const current = { paymentId: "7", actorId: "1", request };
  const previous = { ...current, reversalId: "9007199254740993" };
  assert.deepEqual(cancellationIdempotency(current, null, null), { action: "new" });
  assert.deepEqual(cancellationIdempotency(current, previous, previous), { action: "replay", reversalId: previous.reversalId });
  for (const change of [{ paymentId: "8" }, { actorId: "2" }, { request: { ...request, reason: "Changed reason" } }]) {
    assert.equal(cancellationIdempotency({ ...current, ...change }, previous, previous).action, "conflict");
  }
  assert.deepEqual(cancellationIdempotency(current, null, previous), { action: "conflict", code: "ALREADY_CANCELLED" });
  assert.equal(cancellationIdempotency(current, previous, null).action, "conflict");
  assert.equal(cancellationIdempotency(current, previous, { ...previous, reversalId: "2" }).action, "conflict");
});

const evidenceCases: {
  name: string; target: (input: ReturnType<typeof context>) => object;
  field: string; code: string; bank?: boolean;
}[] = [
  { name: "actor.active", target: i => i.actor, field: "active", code: "OWNER_REQUIRED" },
  { name: "originalLedgerVerified", target: i => i.payment, field: "originalLedgerVerified", code: "LEGACY_OR_UNVERIFIED_PAYMENT" },
  { name: "periodsConfigured", target: i => i, field: "periodsConfigured", code: "PERIODS_NOT_CONFIGURED" },
  { name: "alreadyCancelled", target: i => i.payment, field: "alreadyCancelled", code: "ALREADY_CANCELLED" },
  { name: "alreadyReversed", target: i => i.allocations[0], field: "alreadyReversed", code: "UNVERIFIED_ALLOCATION" },
  { name: "bankEvidenceVerified for bank", target: i => i.payment, field: "bankEvidenceVerified", code: "BANK_CANCELLATION_BLOCKED", bank: true },
  { name: "bankEvidenceVerified for cash", target: i => i.payment, field: "bankEvidenceVerified", code: "INVALID_BANK_EVIDENCE" },
];
for (const entry of evidenceCases) {
  test(`${entry.name} rejects missing and every malformed runtime evidence value`, () => {
    const malformed: unknown[] = [undefined, null, "true", "false", "", 0, 1, -1, {}, [], Symbol("evidence")];
    for (const [index, value] of [...malformed, "OMIT_PROPERTY"].entries()) {
      const input = context();
      if (entry.bank) { input.payment.method = "bank"; input.payment.bankReconciliation = "unreconciled"; }
      if (index === malformed.length) Reflect.deleteProperty(entry.target(input), entry.field);
      else Reflect.set(entry.target(input), entry.field, value);
      blocked(input, entry.code);
    }
  });
}

test("every allocation must carry literal false reversal evidence", () => {
  const input = context(); input.allocations[0].amount = "40";
  input.allocations.push({ ...input.allocations[0], id: "10", invoice: { ...input.allocations[0].invoice, id: "5" } });
  assert.equal(evaluateCancellationEligibility(input).eligible, true);
  Reflect.deleteProperty(input.allocations[1], "alreadyReversed");
  blocked(input, "UNVERIFIED_ALLOCATION");
});

test("direct arithmetic also rejects malformed payment and allocation evidence", () => {
  for (const [field, code] of [["originalLedgerVerified", "LEGACY_OR_UNVERIFIED_PAYMENT"],
    ["alreadyCancelled", "ALREADY_CANCELLED"], ["bankEvidenceVerified", "INVALID_BANK_EVIDENCE"]]) {
    const p = { ...payment }; Reflect.deleteProperty(p, field);
    throwsCode(() => calculatePaymentCancellation(p, [allocation], "0"), code);
  }
  const a = { ...allocation }; Reflect.set(a, "alreadyReversed", "false");
  throwsCode(() => calculatePaymentCancellation(payment, [a], "0"), "UNVERIFIED_ALLOCATION");
});

test("supplier and customer balances can cross from negative to positive", () => {
  for (const partyType of ["supplier", "customer"] as const) {
    const p = { ...payment, partyType };
    const a = { ...allocation, invoice: { ...allocation.invoice, kind: partyType === "supplier" ? "purchase" as const : "sale" as const } };
    const plan = calculatePaymentCancellation(p, [a], "-50.00");
    assert.equal(plan.ledger.balanceBefore, "-50.00"); assert.equal(plan.ledger.balanceAfter, "50.00");
  }
});

test("maximum payment is preserved exactly and zero payment is rejected", () => {
  const max = "999999999999.99";
  const plan = calculatePaymentCancellation({ ...payment, amount: max, allocatedAmount: "0", advanceAmount: max }, [], "0");
  assert.equal(plan.amount, max); assert.equal(plan.advanceReversed, max); assert.equal(plan.ledger.balanceAfter, max);
  assert.deepEqual(plan.book, { method: "cash", in: max, out: "0.00" });
  throwsCode(() => calculatePaymentCancellation({ ...payment, amount: "0", allocatedAmount: "0", advanceAmount: "0" }, [], "0"), "INVALID_PAYMENT_AMOUNT");
});

test("only confirmed payment status is supported", () => {
  for (const status of ["voided", "cancelled", "pending", "", "CONFIRMED"]) {
    const input = context(); input.payment.status = status; blocked(input, "UNSUPPORTED_PAYMENT_STATUS");
  }
});

test("accounting period boundaries are inclusive and an internal gap is blocked", () => {
  const calendar: AccountingPeriod[] = [
    { startsOn: "2026-10-01", endsOn: "2026-10-10", status: "open" },
    { startsOn: "2026-10-12", endsOn: "2026-10-31", status: "open" },
  ];
  assert.doesNotThrow(() => assertOpenCancellationPeriods(calendar, ["2026-10-01", "2026-10-10", "2026-10-12", "2026-10-31"]));
  throwsCode(() => assertOpenCancellationPeriods(calendar, ["2026-10-11"]), "PERIOD_COVERAGE_MISSING");
});

test("a different idempotency key cannot create a second cancellation", () => {
  const previous = { paymentId: "7", actorId: "1", request, reversalId: "1" };
  const second = { ...previous, request: { ...request, idempotencyKey: "87654321-1234-4234-8234-123456789abc" } };
  assert.deepEqual(cancellationIdempotency(second, null, previous), { action: "conflict", code: "ALREADY_CANCELLED" });
});

test("uppercase UUID keys normalize and replay the canonical stored request", () => {
  const uppercase = { ...request, idempotencyKey: request.idempotencyKey.toUpperCase() };
  assert.equal(validateCancellationRequest(uppercase).idempotencyKey, request.idempotencyKey);
  const previous = { paymentId: "7", actorId: "1", request, reversalId: "1" };
  assert.deepEqual(cancellationIdempotency({ ...previous, request: uppercase }, previous, previous), { action: "replay", reversalId: "1" });
});

test("verified bank reversals preserve bank method and opposite directions", () => {
  for (const partyType of ["supplier", "customer"] as const) {
    const input = context(); input.payment.method = "bank"; input.payment.partyType = partyType;
    input.payment.bankReconciliation = "unreconciled"; input.payment.bankEvidenceVerified = true;
    input.allocations[0].invoice.kind = partyType === "supplier" ? "purchase" : "sale";
    const result = evaluateCancellationEligibility(input); assert.ok(result.eligible);
    assert.deepEqual(result.plan.book, { method: "bank", in: partyType === "supplier" ? "100.00" : "0.00", out: partyType === "supplier" ? "0.00" : "100.00" });
    assert.equal(result.plan.ledger.debit, partyType === "supplier" ? "0.00" : "100.00");
    assert.equal(result.plan.ledger.credit, partyType === "supplier" ? "100.00" : "0.00");
  }
});

test("recorded allocation sum mismatch fails even when payment equals actual allocations plus advance", () => {
  // Actual allocations (80) + advance (20) still equal payment (100).
  throwsCode(() => calculatePaymentCancellation({ ...payment, allocatedAmount: "79.99" }, [allocation], "0"), "ALLOCATION_CONSERVATION_FAILED");
});

test("explicit negative invoice settlement is rejected", () => {
  throwsCode(() => calculatePaymentCancellation(payment, [{ ...allocation,
    invoice: { ...allocation.invoice, settled: "-1.00", remaining: "201.00" } }], "0"), "INVALID_MONEY");
});

test("PostgreSQL Int identifiers accept the maximum and reject overflow in each context", () => {
  const setters: ((input: ReturnType<typeof context>, id: string) => void)[] = [
    (i, id) => { i.payment.id = id; i.allocations[0].paymentId = id; },
    (i, id) => { i.payment.partyId = id; i.allocations[0].invoice.partyId = id; },
    (i, id) => { i.allocations[0].id = id; },
    (i, id) => { i.allocations[0].invoice.id = id; },
  ];
  for (const set of setters) {
    const maximum = context(); set(maximum, "2147483647"); assert.equal(evaluateCancellationEligibility(maximum).eligible, true);
    for (const id of ["2147483648", "9223372036854775807", "0", "-1", "01", "1e2"]) {
      const invalid = context(); set(invalid, id); blocked(invalid, "INVALID_ID");
    }
  }
  for (const field of ["paymentId", "partyId"] as const) {
    const input = context();
    if (field === "paymentId") input.allocations[0].paymentId = "2147483648";
    else input.allocations[0].invoice.partyId = "2147483648";
    blocked(input, "INVALID_ID");
  }
  const actor = context(); actor.actor.id = "2147483647"; assert.equal(evaluateCancellationEligibility(actor).eligible, true);
  actor.actor.id = "2147483648"; blocked(actor, "OWNER_REQUIRED");
});

test("idempotency uses Int payment/actor IDs and signed BigInt reversal IDs", () => {
  const current = { paymentId: "2147483647", actorId: "2147483647", request };
  assert.deepEqual(cancellationIdempotency(current, null, null), { action: "new" });
  for (const field of ["paymentId", "actorId"] as const) {
    for (const id of ["2147483648", "0", "-1", "01", 1, null, undefined]) {
      throwsCode(() => cancellationIdempotency({ ...current, [field]: id } as typeof current, null, null), "INVALID_ID");
    }
  }
  const maximum = { ...current, reversalId: "9223372036854775807" };
  assert.deepEqual(cancellationIdempotency(current, maximum, maximum), { action: "replay", reversalId: maximum.reversalId });
  for (const id of ["9223372036854775808", "99999999999999999999", "0", "-1", "01", 1, null, undefined]) {
    const invalid = { ...maximum, reversalId: id } as typeof maximum;
    assert.deepEqual(cancellationIdempotency(current, invalid, invalid), { action: "conflict", code: "IDEMPOTENCY_CONFLICT" });
  }
});
