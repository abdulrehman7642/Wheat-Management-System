import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../app/generated/prisma/client";
import { createCompanyGrowthGetHandler } from "../app/lib/companyGrowthEndpoint";
import { loadCompanyGrowth } from "../app/lib/companyGrowthAnalytics";

const d = (value: string | number) => new Prisma.Decimal(value);

type Calls = { sales: unknown[]; purchases: unknown[]; expenses: unknown[]; raw: unknown[]; writes: string[] };

function syntheticReader(calls: Calls) {
  let salesAggregateCalls = 0;
  return {
    sales: {
      aggregate: async (args: unknown) => {
        calls.sales.push(args);
        salesAggregateCalls += 1;
        return salesAggregateCalls === 1
          ? { _sum: { total_amount: d("300.00"), maunds: d("3"), net_weight_kg: d("120") }, _count: { id: 2 } }
          : { _sum: { total_amount: d("150.00") }, _count: { id: 1 } };
      },
      findMany: async (args: unknown) => {
        calls.sales.push(args);
        return [
          { date: new Date("2026-01-02T00:00:00Z"), total_amount: d("100.00"), maunds: d("1"), rate_per_maund: d("100"), wheat_type_id: 1, customers: { name: "Customer A" }, wheat_types: { name: "Wheat A" } },
          { date: new Date("2026-01-03T00:00:00Z"), total_amount: d("200.00"), maunds: d("2"), rate_per_maund: d("100"), wheat_type_id: 1, customers: { name: "Customer A" }, wheat_types: { name: "Wheat A" } },
        ];
      },
      groupBy: async (args: unknown) => { calls.sales.push(args); return [{ customer_id: 1, _sum: { total_amount: d("300.00") } }]; },
    },
    purchases: {
      aggregate: async (args: unknown) => { calls.purchases.push(args); return { _sum: { total_amount: d("80.00"), maunds: d("1"), net_weight_kg: d("40") }, _count: { id: 1 } }; },
      findMany: async (args: unknown) => { calls.purchases.push(args); return [{ date: new Date("2026-01-03T00:00:00Z"), total_amount: d("80.00"), maunds: d("1"), rate_per_maund: d("80"), wheat_type_id: 1, wheat_types: { name: "Wheat A" } }]; },
      groupBy: async (args: unknown) => { calls.purchases.push(args); return [{ supplier_id: 2, _sum: { total_amount: d("80.00") } }]; },
    },
    expenses: {
      aggregate: async (args: unknown) => { calls.expenses.push(args); return { _sum: { amount: d("10.00") }, _count: { id: 1 } }; },
      findMany: async (args: unknown) => { calls.expenses.push(args); return [{ date: new Date("2026-01-03T00:00:00Z"), amount: d("10.00") }]; },
    },
    customers: { findMany: async () => [{ id: 1, name: "Customer A" }] },
    suppliers: { findMany: async () => [{ id: 2, name: "Supplier B" }] },
    $queryRaw: async (query: unknown) => {
      calls.raw.push(query);
      return calls.raw.length === 1
        // A later append with id 20 has a backdated date; existing ERP logic still treats it as current.
        ? [{ account_type: "customer", account_id: 1, balance: d("75.00"), party_name: "Customer A" }, { account_type: "supplier", account_id: 2, balance: d("40.00"), party_name: "Supplier B" }]
        : [{ wheat_type_id: 1, name: "Wheat A", balance_kg: d("60"), conversion_to_kg: d("40") }];
    },
  };
}

function createCalls(): Calls { return { sales: [], purchases: [], expenses: [], raw: [], writes: [] }; }

function rawSql(query: unknown) {
  const value = query as { strings?: readonly string[] };
  return value.strings?.join("") ?? String(query);
}

test("analytics uses one source row per transaction, excludes voided records, and uses append-order balances", async () => {
  const calls = createCalls();
  const payload = await loadCompanyGrowth(syntheticReader(calls) as never, "custom", "2026-01-01", "2026-01-31");
  assert.equal(payload.kpis.salesRevenue, "300.00");
  assert.equal(payload.kpis.salesCount, 2);
  assert.equal(payload.kpis.customerOutstanding, "75.00");
  assert.equal(payload.kpis.supplierOutstanding, "40.00");
  assert.equal(payload.kpis.inventoryKg, "60.00");
  assert.equal(payload.charts.sales.reduce((total, point) => total.plus(point.value), d(0)).toFixed(2), "300.00");
  for (const query of [...calls.sales, ...calls.purchases]) {
    assert.deepEqual((query as { where: { status: { not: string } } }).where.status, { not: "voided" });
  }
  assert.match(rawSql(calls.raw[0]), /ORDER BY l\.account_type, l\.account_id, l\.id DESC/);
  assert.doesNotMatch(rawSql(calls.raw[0]), /l\.date DESC/);
  assert.match(rawSql(calls.raw[1]), /ORDER BY i\.wheat_type_id, i\.id DESC/);
  assert.deepEqual(calls.writes, []);
});

test("API handler rejects unauthenticated and non-owner requests before opening a snapshot", async () => {
  for (const [session, status] of [[{}, 401], [{ userId: 7, roleName: "accountant" }, 403]] as const) {
    let snapshots = 0;
    const handler = createCompanyGrowthGetHandler({ getSession: async () => session, isOwner: current => current.roleName === "owner", withSnapshot: async () => { snapshots += 1; throw new Error("must not run"); } });
    const response = await handler(new Request("http://test/api/company-growth"));
    assert.equal(response.status, status);
    assert.equal(snapshots, 0);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  }
});

test("owner API request uses the bounded snapshot and rejects invalid custom dates before database access", async () => {
  const calls = createCalls();
  const reader = syntheticReader(calls);
  let snapshots = 0;
  const handler = createCompanyGrowthGetHandler({
    getSession: async () => ({ userId: 1, roleName: "owner" }),
    isOwner: current => current.roleName === "owner",
    withSnapshot: async work => { snapshots += 1; return work(reader as never); },
  });
  const valid = await handler(new Request("http://test/api/company-growth?period=custom&start=2026-01-01&end=2026-01-31"));
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).kpis.salesRevenue, "300.00");
  assert.equal(snapshots, 1);
  const invalid = await handler(new Request("http://test/api/company-growth?period=custom&start=2026-02-30&end=2026-03-01"));
  assert.equal(invalid.status, 400);
  assert.equal(snapshots, 1);
});
