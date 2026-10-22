"use client";

import { useEffect, useState } from "react";
import AppLayout from "./components/AppLayout";
import { KpiCard, Card, CardHeader, StatusBadge } from "./components/ui";

type DashboardData = {
  totalStockKg: number;
  totalStockMaunds: number;
  stockByType: { name: string; category: string | null; maunds: number }[];
  totalReceivable: number;
  totalPayable: number;
  todayPurchaseAmount: number;
  todayPurchaseCount: number;
  todaySaleAmount: number;
  todaySaleCount: number;
  cashBalance: number;
  bankBalance: number;
  recentPurchases: { id: number; voucher_no: string; supplier: string; maunds: number; amount: number; status: string }[];
  recentSales: { id: number; voucher_no: string; customer: string; maunds: number; amount: number; status: string }[];
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));
const fmtMaunds = (n: number) => n.toFixed(2);
const fmtRs = (n: number) => `Rs. ${fmt(n)}`;

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");

    useEffect(() => {
    fetch(`/api/dashboard?period=${period}`)
      .then((res) => res.json())
      .then(setData);
  }, [period]);

  return (
    <AppLayout title="Dashboard" subtitle="Malik Yaseen & Company — business overview">
      <div className="fade-in">
        <div
          className="flex items-center gap-1 mb-8 p-1 rounded-sm w-fit"
          style={{ background: "var(--bg-card)", border: "1px solid var(--bd)" }}
        >
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`font-mono text-xs uppercase tracking-wider px-4 py-1.5 rounded-sm transition-all duration-200 ${period === p ? "bg-[#C9A227] text-[#0A1628] font-semibold" : ""
                }`}
              style={period !== p ? { color: "var(--tx-muted)" } : {}}
            >
              {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        <div
          className="mb-6 rounded-sm p-6 relative overflow-hidden"
          style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#C9A227] mb-1">
                Current Wheat Stock
              </p>
              <div className="flex items-baseline gap-4">
                <span className="font-display text-4xl font-semibold" style={{ color: "var(--tx-primary)" }}>
                  {data ? fmtMaunds(data.totalStockMaunds) : "—"}
                </span>
                <span className="font-mono text-lg" style={{ color: "var(--tx-muted)" }}>
                  Maunds
                </span>
                <span className="font-mono text-sm" style={{ color: "var(--tx-muted)" }}>
                  / {data ? fmt(data.totalStockKg) : "—"} KG
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center">
              {data?.stockByType.map((s) => (
                <div key={s.name}>
                  <p className="font-mono text-xs" style={{ color: "var(--tx-muted)" }}>
                    {s.category || s.name}
                  </p>
                  <p className="font-display text-xl font-semibold" style={{ color: "var(--tx-primary)" }}>
                    {fmtMaunds(s.maunds)}
                  </p>
                  <p className="font-mono text-[10px]" style={{ color: "var(--tx-muted)" }}>
                    Maunds
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
          <KpiCard
            label="Purchases"
            value={data ? fmtRs(data.todayPurchaseAmount) : "—"}
            sub={data ? `${data.todayPurchaseCount} vouchers` : ""}
          />
          <KpiCard
            label="Sales"
            value={data ? fmtRs(data.todaySaleAmount) : "—"}
            sub={data ? `${data.todaySaleCount} invoices` : ""}
          />
          <KpiCard
            label="Receivables"
            value={data ? fmtRs(data.totalReceivable) : "—"}
            sub="Outstanding"
            positive={true}
          />
          <KpiCard
            label="Payables"
            value={data ? fmtRs(data.totalPayable) : "—"}
            sub="Outstanding"
            positive={false}
          />
          <KpiCard label="Cash" value={data ? fmtRs(data.cashBalance) : "—"} sub="In hand" />
          <KpiCard label="Bank" value={data ? fmtRs(data.bankBalance) : "—"} sub="All accounts" />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <h3 className="font-display text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>
                Recent Purchases
              </h3>
              <span className="font-mono text-[10px] text-[#C9A227] uppercase tracking-wider">Wheat In</span>
            </CardHeader>
            <div className="table-scroll">
              <table className="w-full ledger-table">
                <thead>
                  <tr>
                    <th>V. No.</th>
                    <th>Supplier</th>
                    <th className="text-right">Maunds</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentPurchases.map((p) => (
                    <tr key={p.id}>
                      <td className="text-[#C9A227]">{p.voucher_no}</td>
                      <td className="max-w-[120px] truncate" style={{ color: "var(--tx-primary)" }}>
                        {p.supplier}
                      </td>
                      <td className="text-right">{fmt(p.maunds)}</td>
                      <td className="text-right">{fmtRs(p.amount)}</td>
                      <td>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>
                Recent Sales
              </h3>
              <span className="font-mono text-[10px] text-[#C9A227] uppercase tracking-wider">Wheat Out</span>
            </CardHeader>
            <div className="table-scroll">
              <table className="w-full ledger-table">
                <thead>
                  <tr>
                    <th>V. No.</th>
                    <th>Customer</th>
                    <th className="text-right">Maunds</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recentSales.map((s) => (
                    <tr key={s.id}>
                      <td className="text-[#C9A227]">{s.voucher_no}</td>
                      <td className="max-w-[120px] truncate" style={{ color: "var(--tx-primary)" }}>
                        {s.customer}
                      </td>
                      <td className="text-right">{fmt(s.maunds)}</td>
                      <td className="text-right">{fmtRs(s.amount)}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}