"use client";

import { useEffect, useMemo, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, CardHeader, KpiCard } from "../components/ui";

type Point = { label: string; value: string };
type Leader = { name: string; value: string };
type GrowthData = {
  range: { start: string; end: string; label: string };
  kpis: { salesRevenue: string; salesCount: number; salesGrowthPercent: string | null; previousSalesRevenue: string; purchases: string; purchaseCount: number; operatingExpenses: string; expenseCount: number; customerOutstanding: string; supplierOutstanding: string; inventoryKg: string };
  charts: { sales: Point[]; purchases: Point[]; expenses: Point[] };
  wheat: { name: string; salesRevenue: string; soldMaunds: string; averageSalesRate: string | null; averagePurchaseRate: string | null }[];
  leaders: { customersByRevenue: Leader[]; customersByOutstanding: Leader[]; suppliersByPurchase: Leader[]; suppliersByOutstanding: Leader[] };
  limitations: string[];
};

type Period = "7d" | "30d" | "90d" | "this_month" | "last_month" | "this_year" | "last_year" | "custom";
const periods: { value: Period; label: string }[] = [
  { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }, { value: "this_month", label: "This month" }, { value: "last_month", label: "Last month" }, { value: "this_year", label: "This year" }, { value: "last_year", label: "Last year" }, { value: "custom", label: "Custom" },
];

function formatPkr(value: string) {
  const negative = value.startsWith("-"); const [wholeRaw, decimal = "00"] = value.replace(/^-/, "").split(".");
  return `${negative ? "âˆ’" : ""}PKR ${wholeRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${decimal.padEnd(2, "0").slice(0, 2)}`;
}
function quantity(value: string) { return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(value)); }

function Chart({ title, points, tone }: { title: string; points: Point[]; tone: string }) {
  const values = points.map(point => Number(point.value)); const maximum = Math.max(...values, 1);
  const line = values.map((value, index) => `${points.length === 1 ? 50 : index * 100 / (points.length - 1)},${92 - value * 76 / maximum}`).join(" ");
  return <Card className="min-w-0 p-4 sm:p-5"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="font-display text-base font-semibold" style={{ color: "var(--tx-primary)" }}>{title}</h3><p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>Selected transaction dates</p></div><span className="font-mono text-xs" style={{ color: tone }}>{points.length} points</span></div>{points.length ? <><svg viewBox="0 0 100 100" role="img" aria-label={title} className="h-44 w-full overflow-visible" preserveAspectRatio="none"><line x1="0" x2="100" y1="92" y2="92" stroke="var(--bd)" strokeWidth="1" /><polyline points={line} fill="none" stroke={tone} strokeWidth="2.5" vectorEffect="non-scaling-stroke" /></svg><div className="flex justify-between gap-3 font-mono text-[10px]" style={{ color: "var(--tx-muted)" }}><span>{points[0].label}</span><span>{points.at(-1)?.label}</span></div></> : <div className="flex h-44 items-center justify-center font-mono text-xs" style={{ color: "var(--tx-muted)" }}>No verified transactions in this period.</div>}</Card>;
}

function LeaderList({ title, rows, label }: { title: string; rows: Leader[]; label: string }) {
  return <Card><CardHeader><h3 className="font-display text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>{title}</h3><span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>{label}</span></CardHeader><ol>{rows.length ? rows.map((row, index) => <li key={`${row.name}-${index}`} className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2.5 sm:px-5" style={{ borderColor: "var(--bd-soft)" }}><span className="min-w-0 truncate text-sm" style={{ color: "var(--tx-primary)" }}>{index + 1}. {row.name}</span><span className="shrink-0 font-mono text-xs" style={{ color: "var(--gold)" }}>{formatPkr(row.value)}</span></li>) : <li className="px-5 py-5 text-center font-mono text-xs" style={{ color: "var(--tx-muted)" }}>No data for this period.</li>}</ol></Card>;
}

export default function CompanyGrowthPage() {
  const [period, setPeriod] = useState<Period>("30d"); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [data, setData] = useState<GrowthData | null>(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true); const [allowed, setAllowed] = useState<boolean | null>(null);
  const query = useMemo(() => { const params = new URLSearchParams({ period }); if (period === "custom") { params.set("start", start); params.set("end", end); } return params.toString(); }, [period, start, end]);
  useEffect(() => { fetch("/api/auth/me").then(response => response.ok ? response.json() : null).then(session => setAllowed(session?.role === "owner")).catch(() => setAllowed(false)); }, []);
  useEffect(() => {
    if (allowed !== true || (period === "custom" && (!start || !end))) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      fetch(`/api/company-growth?${query}`, { cache: "no-store" })
        .then(async response => ({ response, body: await response.json() }))
        .then(({ response, body }) => {
          if (!response.ok) throw new Error(body.error || "Analytics could not be loaded.");
          if (active) setData(body);
        })
        .catch(reason => active && setError(reason instanceof Error ? reason.message : "Analytics could not be loaded."))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [allowed, query, period, start, end]);
  if (allowed === false) return <AppLayout title="Company Growth" subtitle="Owner-only financial analytics"><Card className="p-6"><p style={{ color: "var(--tx-primary)" }}>This page is available to the Owner only.</p></Card></AppLayout>;
  const growth = data?.kpis.salesGrowthPercent; const growthText = growth === null ? "N/A" : `${Number(growth ?? 0) >= 0 ? "Up" : "Down"} ${Math.abs(Number(growth ?? 0)).toFixed(2)}%`;
  return <AppLayout title="Company Growth" subtitle="Owner-only, read-only business analytics"><div className="fade-in space-y-5"><Card className="p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#C9A227]">Analysis period</p><p className="mt-1 font-display text-lg font-semibold" style={{ color: "var(--tx-primary)" }}>{data?.range.label || "Select a period"}</p><p className="font-mono text-xs" style={{ color: "var(--tx-muted)" }}>Sales and purchases exclude voided vouchers. Dates use ERP transaction dates.</p></div><div className="flex flex-wrap gap-2">{periods.map(option => <button key={option.value} onClick={() => setPeriod(option.value)} className={`rounded-sm px-3 py-2 font-mono text-xs ${period === option.value ? "bg-[#C9A227] font-semibold text-[#0A1628]" : "border"}`} style={period === option.value ? {} : { borderColor: "var(--bd)", color: "var(--tx-muted)" }}>{option.label}</button>)}</div></div>{period === "custom" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="font-mono text-xs" style={{ color: "var(--tx-muted)" }}>Start date<input value={start} onChange={event => setStart(event.target.value)} type="date" className="mt-1 block w-full rounded-sm border px-3 py-2" style={{ borderColor: "var(--bd)", background: "var(--bg-input)", color: "var(--tx-primary)" }} /></label><label className="font-mono text-xs" style={{ color: "var(--tx-muted)" }}>End date<input value={end} onChange={event => setEnd(event.target.value)} type="date" className="mt-1 block w-full rounded-sm border px-3 py-2" style={{ borderColor: "var(--bd)", background: "var(--bg-input)", color: "var(--tx-primary)" }} /></label></div>}</Card>{error && <Card className="p-4"><p className="font-mono text-sm text-red-400">{error}</p></Card>}{loading && !data ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Card key={index} className="h-32 animate-pulse">&nbsp;</Card>)}</div> : data && <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Sales revenue" value={formatPkr(data.kpis.salesRevenue)} sub={`${data.kpis.salesCount} invoices`} /><KpiCard label="Sales growth" value={growthText} sub={growth === null ? "No prior revenue" : `Previous: ${formatPkr(data.kpis.previousSalesRevenue)}`} positive={growth === null ? undefined : Number(growth) >= 0} /><KpiCard label="Total purchases" value={formatPkr(data.kpis.purchases)} sub={`${data.kpis.purchaseCount} vouchers`} /><KpiCard label="Operating expenses" value={formatPkr(data.kpis.operatingExpenses)} sub={`${data.kpis.expenseCount} entries`} positive={false} /><KpiCard label="Customer outstanding" value={formatPkr(data.kpis.customerOutstanding)} sub="Current ledger balance" /><KpiCard label="Supplier outstanding" value={formatPkr(data.kpis.supplierOutstanding)} sub="Current ledger balance" /><KpiCard label="Inventory quantity" value={`${quantity(data.kpis.inventoryKg)} KG`} sub="Current balance; value unavailable" /><KpiCard label="Gross / net profit" value="Unavailable" sub="No verified COGS allocation" /></section><section className="grid gap-4 xl:grid-cols-3"><Chart title="Sales revenue trend" points={data.charts.sales} tone="#C9A227" /><Chart title="Purchases trend" points={data.charts.purchases} tone="#60A5FA" /><Chart title="Expense trend" points={data.charts.expenses} tone="#F87171" /></section><section className="grid gap-4 lg:grid-cols-2"><LeaderList title="Top customers by sales" rows={data.leaders.customersByRevenue} label="Revenue" /><LeaderList title="Top customers by outstanding" rows={data.leaders.customersByOutstanding} label="Current balance" /><LeaderList title="Top suppliers by purchases" rows={data.leaders.suppliersByPurchase} label="Purchases" /><LeaderList title="Supplier obligations" rows={data.leaders.suppliersByOutstanding} label="Current balance" /></section><Card><CardHeader><div><h3 className="font-display text-base font-semibold" style={{ color: "var(--tx-primary)" }}>Wheat trading performance</h3><p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>Actual invoice rates; no inferred margin</p></div></CardHeader><div className="table-scroll"><table className="ledger-table w-full"><thead><tr><th>Wheat type</th><th className="text-right">Sales revenue</th><th className="text-right">Sold maunds</th><th className="text-right">Average Invoice Sale Rate</th><th className="text-right">Average Invoice Purchase Rate</th></tr></thead><tbody>{data.wheat.length ? data.wheat.map(row => <tr key={row.name}><td style={{ color: "var(--tx-primary)" }}>{row.name}</td><td className="text-right">{formatPkr(row.salesRevenue)}</td><td className="text-right">{quantity(row.soldMaunds)}</td><td className="text-right">{row.averageSalesRate ? formatPkr(row.averageSalesRate) : "â€”"}</td><td className="text-right">{row.averagePurchaseRate ? formatPkr(row.averagePurchaseRate) : "â€”"}</td></tr>) : <tr><td colSpan={5} className="text-center">No wheat transactions in this period.</td></tr>}</tbody></table></div></Card><Card className="p-4 sm:p-5"><h3 className="font-display text-base font-semibold" style={{ color: "var(--tx-primary)" }}>Financial data limits</h3><ul className="mt-3 list-disc space-y-2 pl-5 font-mono text-xs" style={{ color: "var(--tx-muted)" }}>{data.limitations.map(note => <li key={note}>{note}</li>)}</ul></Card></>}</div></AppLayout>;
}
