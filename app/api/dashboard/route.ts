import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wheatTypes = await prisma.wheat_types.findMany({ include: { units: true } });
  let totalStockKg = 0;
  const stockByType: { name: string; category: string | null; maunds: number }[] = [];
  for (const wt of wheatTypes) {
    const last = await prisma.inventory_transactions.findFirst({
      where: { wheat_type_id: wt.id },
      orderBy: { id: "desc" },
    });
    const balanceKg = last ? Number(last.balance_kg) : 0;
    totalStockKg += balanceKg;
    const conversion = wt.units ? Number(wt.units.conversion_to_kg) : 1;
    stockByType.push({ name: wt.name, category: wt.category, maunds: balanceKg / conversion });
  }
  const totalStockMaunds = stockByType.reduce((sum, x) => sum + x.maunds, 0);

  const customers = await prisma.customers.findMany();
  let totalReceivable = 0;
  for (const c of customers) {
    const last = await prisma.ledger_entries.findFirst({
      where: { account_type: "customer", account_id: c.id },
      orderBy: { id: "desc" },
    });
    if (last && Number(last.balance) > 0) totalReceivable += Number(last.balance);
  }

  const suppliers = await prisma.suppliers.findMany();
  let totalPayable = 0;
  for (const s of suppliers) {
    const last = await prisma.ledger_entries.findFirst({
      where: { account_type: "supplier", account_id: s.id },
      orderBy: { id: "desc" },
    });
    if (last && Number(last.balance) > 0) totalPayable += Number(last.balance);
  }

    const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "today";

  const now = new Date();
  let rangeStart: Date;

  if (period === "week") {
    const day = now.getDay(); // 0 = Sunday
    const diffToMonday = day === 0 ? 6 : day - 1;
    rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() - diffToMonday);
    rangeStart.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
  }

  const todayPurchases = await prisma.purchases.findMany({ where: { date: { gte: rangeStart } } });
  const todaySales = await prisma.sales.findMany({ where: { date: { gte: rangeStart } } });

  const cashPayments = await prisma.payments.findMany({ where: { method: "cash" }, include: { payment_reversal: true } });
  let cashBalance = 0;
  for (const p of cashPayments) {
    cashBalance += p.party_type === "supplier" ? -Number(p.amount) : Number(p.amount);
    if (p.payment_reversal) cashBalance += p.party_type === "supplier" ? Number(p.amount) : -Number(p.amount);
  }

  const bankPayments = await prisma.payments.findMany({ where: { method: "bank" }, include: { payment_reversal: true } });
  let bankBalance = 0;
  for (const p of bankPayments) {
    bankBalance += p.party_type === "supplier" ? -Number(p.amount) : Number(p.amount);
    if (p.payment_reversal) bankBalance += p.party_type === "supplier" ? Number(p.amount) : -Number(p.amount);
  }

  const recentPurchases = await prisma.purchases.findMany({
    include: { suppliers: true },
    orderBy: { id: "desc" },
    take: 4,
  });
  const recentSales = await prisma.sales.findMany({
    include: { customers: true },
    orderBy: { id: "desc" },
    take: 4,
  });

  function statusOf(paid: number, remaining: number) {
    if (remaining <= 0) return "paid";
    if (paid > 0) return "partial";
    return "pending";
  }

  return NextResponse.json({
    totalStockKg,
    totalStockMaunds,
    stockByType: stockByType.filter((s) => s.maunds > 0).slice(0, 3),
    totalReceivable,
    totalPayable,
    todayPurchaseAmount: todayPurchases.reduce((s, p) => s + Number(p.total_amount), 0),
    todayPurchaseCount: todayPurchases.length,
    todaySaleAmount: todaySales.reduce((s, sale) => s + Number(sale.total_amount), 0),
    todaySaleCount: todaySales.length,
    cashBalance,
    bankBalance,
    recentPurchases: recentPurchases.map((p) => ({
      id: p.id,
      voucher_no: p.voucher_no,
      supplier: p.suppliers.name,
      maunds: Number(p.maunds),
      amount: Number(p.total_amount),
      status: statusOf(Number(p.paid_amount), Number(p.remaining_amount)),
    })),
    recentSales: recentSales.map((s) => ({
      id: s.id,
      voucher_no: s.voucher_no,
      customer: s.customers.name,
      maunds: Number(s.maunds),
      amount: Number(s.total_amount),
      status: statusOf(Number(s.received_amount), Number(s.remaining_amount)),
    })),
  });
}
