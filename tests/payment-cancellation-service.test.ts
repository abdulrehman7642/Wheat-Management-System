import assert from "node:assert/strict";
import test from "node:test";
import { Decimal } from "@prisma/client/runtime/client";
import { cancelPaymentTx } from "../app/lib/paymentCancellation";
import type { Tx } from "../app/lib/purchaseOps";

const request = { reason: "Duplicate entry", intent: "correction", idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" };

function cancellationTx(options: { enabled?: boolean; method?: "cash" | "bank"; actorRole?: string } = {}) {
  const writes: { table: string; data: Record<string, unknown> }[] = [];
  const invoice = { id: 7, supplier_id: 3, status: "confirmed", date: new Date("2026-10-10T00:00:00Z"),
    total_amount: new Decimal("100"), paid_amount: new Decimal("20"), remaining_amount: new Decimal("80") };
  const allocation = { id: 41, payment_id: 11, allocated_amount: new Decimal("20"), tracking_version: 1,
    purchase_id: 7, sale_id: null, purchase: invoice, sale: null, allocation_reversal: null };
  const posting = { id: BigInt(31), payment_id: 11, original_ledger_entry_id: BigInt(21), payment_date: new Date("2026-10-10T00:00:00Z"),
    party_type: "supplier", party_id: 3, method: options.method ?? "cash", amount: new Decimal("20"),
    allocated_amount: new Decimal("20"), advance_amount: new Decimal("0"), source_path: "purchase_add_payment", tracking_version: 1,
    bank_reconciliation_status: options.method === "bank" ? "unknown" : "not_applicable", created_by: 1,
    original_ledger_entry: { id: BigInt(21), ref_id: 11 }, payment_allocations: [allocation] };
  const tx = {
    $queryRawUnsafe: async () => [],
    users: { findUnique: async () => ({ id: 1, status: "active", roles: { name: options.actorRole ?? "owner" } }) },
    payment_reversals: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ table: "reversal", data }); return { id: BigInt(51), ...data }; },
    },
    financial_controls: { findUnique: async () => ({ payment_cancellation_enabled: options.enabled ?? true, accounting_periods_required: true }) },
    payments: { findUnique: async () => ({ id: 11, voucher_no: "PV-9", date: posting.payment_date, party_type: "supplier", party_id: 3,
      amount: posting.amount, method: posting.method, status: "confirmed", payment_posting: posting, payment_reversal: null }) },
    accounting_periods: { findMany: async () => [{ id: 1, start_date: new Date("2026-01-01T00:00:00Z"), end_date: new Date("2026-12-31T00:00:00Z"), status: "open" }] },
    ledger_entries: {
      findFirst: async () => ({ balance: new Decimal("80") }),
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ table: "ledger", data }); return { id: BigInt(61), ...data }; },
    },
    purchases: { update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ table: "purchase", data }); return data; } },
    sales: { update: async () => { throw new Error("unexpected sale update"); } },
    payment_reversal_counters: { update: async () => ({ prefix: "PCR", current_number: BigInt(1) }) },
    payment_allocation_reversals: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ table: "allocation_reversal", data }); return data; } },
    audit_logs: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ table: "audit", data }); return data; } },
  };
  return { tx: tx as unknown as Tx, writes };
}

test("cash cancellation atomically restores invoice, ledger, history and audit", async () => {
  const { tx, writes } = cancellationTx();
  const reversal = await cancelPaymentTx(tx, { paymentId: 11, actorId: 1, request, serverInstant: new Date("2026-10-20T12:00:00Z") });
  assert.equal(reversal.voucher_no, "PCR-1");
  const purchase = writes.find(w => w.table === "purchase")!.data;
  assert.equal(String(purchase.paid_amount), "0");
  assert.equal(String(purchase.remaining_amount), "100");
  const ledger = writes.find(w => w.table === "ledger")!.data;
  assert.equal(String(ledger.credit), "20");
  assert.equal(String(ledger.balance), "100");
  assert.deepEqual(writes.map(w => w.table), ["purchase", "ledger", "reversal", "allocation_reversal", "audit"]);
});

test("disabled control, non-owner database role and unknown bank evidence fail closed", async () => {
  await assert.rejects(cancelPaymentTx(cancellationTx({ enabled: false }).tx,
    { paymentId: 11, actorId: 1, request, serverInstant: new Date() }), /PAYMENT_CANCELLATION_DISABLED/);
  await assert.rejects(cancelPaymentTx(cancellationTx({ actorRole: "accountant" }).tx,
    { paymentId: 11, actorId: 1, request, serverInstant: new Date() }), /OWNER_REQUIRED/);
  await assert.rejects(cancelPaymentTx(cancellationTx({ method: "bank" }).tx,
    { paymentId: 11, actorId: 1, request, serverInstant: new Date("2026-10-20T12:00:00Z") }), /BANK_CANCELLATION_BLOCKED/);
});
