import assert from "node:assert/strict";
import test from "node:test";
import { Decimal } from "@prisma/client/runtime/client";
import { assertInvoiceHasNoTrackedPayments, postTrackedPayment } from "../app/lib/paymentPosting";
import type { Tx } from "../app/lib/purchaseOps";

function purchaseTx() {
  const writes: Record<string, unknown>[] = [];
  const invoice = { id: 7, supplier_id: 3, status: "confirmed", total_amount: new Decimal("100.00"),
    paid_amount: new Decimal("50.00"), remaining_amount: new Decimal("50.00"), date: new Date("2026-10-01") };
  const tx = {
    $queryRawUnsafe: async (...args: unknown[]) => { writes.push({ lock: args }); return []; },
    document_numbering: { update: async () => ({ prefix: "PV", current_number: 9 }) },
    payments: { create: async ({ data }: { data: Record<string, unknown> }) => ({ id: 11, ...data }) },
    ledger_entries: {
      findFirst: async () => ({ balance: new Decimal("100.00") }),
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ ledger: data }); return { id: BigInt(21), ...data }; },
    },
    purchases: {
      findUnique: async () => invoice,
      findUniqueOrThrow: async () => invoice,
      findMany: async () => [invoice],
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ purchase: data }); return { ...invoice, ...data }; },
    },
    sales: { findMany: async () => [], findUnique: async () => null },
    payment_postings: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ posting: data }); return { id: BigInt(31), ...data }; } },
    payment_allocations: {
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ allocation: data }); return { id: 41, ...data }; },
      count: async () => 0,
    },
  };
  return { tx: tx as unknown as Tx, writes };
}

test("invoice-specific posting conserves exact allocation and running balance", async () => {
  const { tx, writes } = purchaseTx();
  const payment = await postTrackedPayment(tx, { date: new Date("2026-10-20"), partyType: "supplier", partyId: 3,
    amount: "20.00", method: "cash", userId: 1, sourcePath: "purchase_add_payment", target: { kind: "purchase", id: 7 } });
  assert.equal(payment.id, 11);
  const posting = writes.find(w => "posting" in w)?.posting as Record<string, Decimal>;
  assert.equal(posting.amount.toString(), "20");
  assert.equal(posting.allocated_amount.toString(), "20");
  assert.equal(posting.advance_amount.toString(), "0");
  const ledger = writes.find(w => "ledger" in w)?.ledger as Record<string, Decimal>;
  assert.equal(ledger.debit.toString(), "20");
  assert.equal(ledger.credit.toString(), "0");
  assert.equal(ledger.balance.toString(), "80");
  const purchase = writes.find(w => "purchase" in w)?.purchase as Record<string, Decimal>;
  assert.equal(purchase.paid_amount.toString(), "70");
  assert.equal(purchase.remaining_amount.toString(), "30");
  const allocation = writes.find(w => "allocation" in w)?.allocation as Record<string, unknown>;
  assert.equal(allocation.purchase_id, 7);
  assert.equal(allocation.sale_id, null);
  assert.equal(allocation.tracking_version, 1);
});

test("FIFO posting records an exact unallocated advance", async () => {
  const { tx, writes } = purchaseTx();
  await postTrackedPayment(tx, { date: new Date("2026-10-20"), partyType: "supplier", partyId: 3,
    amount: "75.00", method: "cash", userId: 1, sourcePath: "standalone_fifo", fifo: true });
  const posting = writes.find(w => "posting" in w)?.posting as Record<string, Decimal>;
  assert.equal(posting.allocated_amount.toString(), "50");
  assert.equal(posting.advance_amount.toString(), "25");
});

test("bank postings remain unknown and therefore ineligible for cancellation", async () => {
  const { tx, writes } = purchaseTx();
  await postTrackedPayment(tx, { date: new Date("2026-10-20"), partyType: "supplier", partyId: 3,
    amount: "1.00", method: "bank", userId: 1, sourcePath: "purchase_add_payment", target: { kind: "purchase", id: 7 } });
  const posting = writes.find(w => "posting" in w)?.posting as Record<string, unknown>;
  assert.equal(posting.bank_reconciliation_status, "unknown");
});

test("posting rejects zero, excess and mismatched-party payments atomically", async () => {
  for (const amount of ["0.00", "50.01", "1000000000000.00"]) {
    const { tx } = purchaseTx();
    await assert.rejects(postTrackedPayment(tx, { date: new Date(), partyType: "supplier", partyId: 3,
      amount, method: "cash", userId: 1, sourcePath: "purchase_add_payment", target: { kind: "purchase", id: 7 } }));
  }
  const { tx } = purchaseTx();
  await assert.rejects(postTrackedPayment(tx, { date: new Date(), partyType: "supplier", partyId: 4,
    amount: "1.00", method: "cash", userId: 1, sourcePath: "purchase_add_payment", target: { kind: "purchase", id: 7 } }),
  /party does not match/);
});

test("tracked invoice guard blocks edit/void and allows untracked invoice", async () => {
  const blocked = purchaseTx();
  Object.assign((blocked.tx as unknown as { payment_allocations: { count: () => Promise<number> } }).payment_allocations,
    { count: async () => 1 });
  await assert.rejects(assertInvoiceHasNoTrackedPayments(blocked.tx, "purchase", 7), /must be cancelled/);
  const clear = purchaseTx();
  await assert.doesNotReject(assertInvoiceHasNoTrackedPayments(clear.tx, "purchase", 7));
});
