import { Prisma } from "@/app/generated/prisma/client";
import { bucketSeries, comparisonRange, decimalText, percentChange, resolveGrowthRange, sumMoney, type GrowthPeriod } from "@/app/lib/companyGrowth";

type Reader = Pick<Prisma.TransactionClient, "sales" | "purchases" | "expenses" | "customers" | "suppliers" | "$queryRaw">;
type LedgerBalance = { account_type: string; account_id: number; balance: Prisma.Decimal; party_name: string | null };
type InventoryBalance = { wheat_type_id: number; name: string; balance_kg: Prisma.Decimal; conversion_to_kg: Prisma.Decimal | null };

const activeFinancialRecord = { status: { not: "voided" } } as const;

export async function loadCompanyGrowth(reader: Reader, period: GrowthPeriod, customStart?: string | null, customEnd?: string | null) {
  const range = resolveGrowthRange(period, customStart, customEnd);
  const previous = comparisonRange(range);
  const dateWhere = { date: { gte: range.start, lt: range.end }, ...activeFinancialRecord };
  const previousDateWhere = { date: { gte: previous.start, lt: previous.end }, ...activeFinancialRecord };

  const [salesTotals, previousSalesTotals, purchaseTotals, expenseTotals, sales, purchases, expenses, customerGroups, supplierGroups, ledgerBalances, inventoryBalances] = await Promise.all([
    reader.sales.aggregate({ where: dateWhere, _sum: { total_amount: true, maunds: true, net_weight_kg: true }, _count: { id: true } }),
    reader.sales.aggregate({ where: previousDateWhere, _sum: { total_amount: true }, _count: { id: true } }),
    reader.purchases.aggregate({ where: dateWhere, _sum: { total_amount: true, maunds: true, net_weight_kg: true }, _count: { id: true } }),
    reader.expenses.aggregate({ where: { date: { gte: range.start, lt: range.end } }, _sum: { amount: true }, _count: { id: true } }),
    reader.sales.findMany({ where: dateWhere, select: { date: true, total_amount: true, maunds: true, rate_per_maund: true, wheat_type_id: true, customers: { select: { name: true } }, wheat_types: { select: { name: true } } } }),
    reader.purchases.findMany({ where: dateWhere, select: { date: true, total_amount: true, maunds: true, rate_per_maund: true, wheat_type_id: true, wheat_types: { select: { name: true } } } }),
    reader.expenses.findMany({ where: { date: { gte: range.start, lt: range.end } }, select: { date: true, amount: true } }),
    reader.sales.groupBy({ by: ["customer_id"], where: dateWhere, _sum: { total_amount: true }, orderBy: { _sum: { total_amount: "desc" } }, take: 5 }),
    reader.purchases.groupBy({ by: ["supplier_id"], where: dateWhere, _sum: { total_amount: true }, orderBy: { _sum: { total_amount: "desc" } }, take: 5 }),
    reader.$queryRaw<LedgerBalance[]>(Prisma.sql`SELECT DISTINCT ON (l.account_type, l.account_id) l.account_type, l.account_id, l.balance, COALESCE(c.name, s.name) AS party_name FROM public.ledger_entries l LEFT JOIN public.customers c ON l.account_type = 'customer' AND c.id = l.account_id LEFT JOIN public.suppliers s ON l.account_type = 'supplier' AND s.id = l.account_id WHERE l.account_type IN ('customer', 'supplier') ORDER BY l.account_type, l.account_id, l.id DESC`),
    reader.$queryRaw<InventoryBalance[]>(Prisma.sql`SELECT DISTINCT ON (i.wheat_type_id) i.wheat_type_id, w.name, i.balance_kg, u.conversion_to_kg FROM public.inventory_transactions i JOIN public.wheat_types w ON w.id = i.wheat_type_id LEFT JOIN public.units u ON u.id = w.default_unit_id ORDER BY i.wheat_type_id, i.id DESC`),
  ]);

  const customerIds = customerGroups.map(row => row.customer_id);
  const supplierIds = supplierGroups.map(row => row.supplier_id);
  const [customers, suppliers] = await Promise.all([
    reader.customers.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }),
    reader.suppliers.findMany({ where: { id: { in: supplierIds } }, select: { id: true, name: true } }),
  ]);
  const customerName = new Map(customers.map(row => [row.id, row.name]));
  const supplierName = new Map(suppliers.map(row => [row.id, row.name]));
  const latestCustomerBalances = new Map(ledgerBalances.filter(row => row.account_type === "customer").map(row => [row.account_id, row]));
  const latestSupplierBalances = new Map(ledgerBalances.filter(row => row.account_type === "supplier").map(row => [row.account_id, row]));
  const customerOutstanding = sumMoney([...latestCustomerBalances.values()].map(row => row.balance).filter(value => value.greaterThan(0)));
  const supplierOutstanding = sumMoney([...latestSupplierBalances.values()].map(row => row.balance).filter(value => value.greaterThan(0)));

  const wheat = new Map<number, { name: string; revenue: Prisma.Decimal; quantity: Prisma.Decimal; salesRateTotal: Prisma.Decimal; salesRateCount: number; purchaseRateTotal: Prisma.Decimal; purchaseRateCount: number }>();
  for (const sale of sales) {
    const item = wheat.get(sale.wheat_type_id) ?? { name: sale.wheat_types.name, revenue: new Prisma.Decimal(0), quantity: new Prisma.Decimal(0), salesRateTotal: new Prisma.Decimal(0), salesRateCount: 0, purchaseRateTotal: new Prisma.Decimal(0), purchaseRateCount: 0 };
    item.revenue = item.revenue.plus(sale.total_amount); item.quantity = item.quantity.plus(sale.maunds); item.salesRateTotal = item.salesRateTotal.plus(sale.rate_per_maund); item.salesRateCount += 1; wheat.set(sale.wheat_type_id, item);
  }
  for (const purchase of purchases) {
    const item = wheat.get(purchase.wheat_type_id) ?? { name: purchase.wheat_types.name, revenue: new Prisma.Decimal(0), quantity: new Prisma.Decimal(0), salesRateTotal: new Prisma.Decimal(0), salesRateCount: 0, purchaseRateTotal: new Prisma.Decimal(0), purchaseRateCount: 0 };
    item.purchaseRateTotal = item.purchaseRateTotal.plus(purchase.rate_per_maund); item.purchaseRateCount += 1; wheat.set(purchase.wheat_type_id, item);
  }
  const inventoryKg = sumMoney(inventoryBalances.map(row => row.balance_kg));

  return {
    range: { start: range.start.toISOString().slice(0, 10), end: new Date(range.end.valueOf() - 86400000).toISOString().slice(0, 10), label: range.label },
    kpis: {
      salesRevenue: decimalText(salesTotals._sum.total_amount), salesCount: salesTotals._count.id,
      salesGrowthPercent: percentChange(salesTotals._sum.total_amount ?? 0, previousSalesTotals._sum.total_amount ?? 0), previousSalesRevenue: decimalText(previousSalesTotals._sum.total_amount),
      purchases: decimalText(purchaseTotals._sum.total_amount), purchaseCount: purchaseTotals._count.id,
      operatingExpenses: decimalText(expenseTotals._sum.amount), expenseCount: expenseTotals._count.id,
      customerOutstanding: decimalText(customerOutstanding), supplierOutstanding: decimalText(supplierOutstanding),
      inventoryKg: decimalText(inventoryKg), grossProfit: null, grossMargin: null, netProfit: null, inventoryValue: null,
    },
    charts: { sales: bucketSeries(sales.map(row => ({ date: row.date, amount: row.total_amount })), range), purchases: bucketSeries(purchases.map(row => ({ date: row.date, amount: row.total_amount })), range), expenses: bucketSeries(expenses.map(row => ({ date: row.date, amount: row.amount })), range) },
    wheat: [...wheat.values()].sort((a, b) => b.revenue.comparedTo(a.revenue)).map(item => ({ name: item.name, salesRevenue: decimalText(item.revenue), soldMaunds: decimalText(item.quantity), averageSalesRate: item.salesRateCount ? decimalText(item.salesRateTotal.dividedBy(item.salesRateCount)) : null, averagePurchaseRate: item.purchaseRateCount ? decimalText(item.purchaseRateTotal.dividedBy(item.purchaseRateCount)) : null })),
    inventory: inventoryBalances.map(row => ({ name: row.name, quantityKg: decimalText(row.balance_kg), quantityMaunds: row.conversion_to_kg && !row.conversion_to_kg.isZero() ? decimalText(row.balance_kg.dividedBy(row.conversion_to_kg)) : null })),
    leaders: {
      customersByRevenue: customerGroups.map(row => ({ name: customerName.get(row.customer_id) ?? "Unknown customer", value: decimalText(row._sum.total_amount) })),
      customersByOutstanding: [...latestCustomerBalances.entries()].filter(([, row]) => row.balance.greaterThan(0)).sort(([, a], [, b]) => b.balance.comparedTo(a.balance)).slice(0, 5).map(([id, row]) => ({ name: row.party_name ?? customerName.get(id) ?? `Customer #${id}`, value: decimalText(row.balance) })),
      suppliersByPurchase: supplierGroups.map(row => ({ name: supplierName.get(row.supplier_id) ?? "Unknown supplier", value: decimalText(row._sum.total_amount) })),
      suppliersByOutstanding: [...latestSupplierBalances.entries()].filter(([, row]) => row.balance.greaterThan(0)).sort(([, a], [, b]) => b.balance.comparedTo(a.balance)).slice(0, 5).map(([id, row]) => ({ name: row.party_name ?? supplierName.get(id) ?? `Supplier #${id}`, value: decimalText(row.balance) })),
    },
    limitations: ["Gross profit, gross margin, net profit, inventory value, and customer collection performance are unavailable because this ERP does not maintain verified cost-of-goods-sold, inventory-cost allocation, or complete historical collection metrics."],
  };
}
