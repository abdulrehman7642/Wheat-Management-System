"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton, StatusBadge } from "../components/ui";

type Customer = { id: number; code: string; name: string };
type WheatType = { id: number; name: string };
type Sale = {
  id: number;
  voucher_no: string;
  date: string;
  customers: { name: string };
  wheat_types: { name: string };
  maunds: string;
  rate_per_maund: string;
  total_amount: string;
  received_amount: string;
  remaining_amount: string;
  status: string;
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));
const fmtRs = (n: number) => `Rs. ${fmt(n)}`;

function statusOf(received: number, remaining: number) {
  if (remaining <= 0) return "received";
  if (received > 0) return "partial";
  return "pending";
}

async function markPaid(id: number, reload: () => void) {
  if (!window.confirm("Mark this sale as fully received?")) return;
  const res = await fetch(`/api/sales/${id}/mark-paid`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || "Failed.");
    return;
  }
  reload();
}

async function addPayment(id: number, remaining: number, reload: () => void) {
  const input = window.prompt(`Remaining: Rs. ${remaining}. Kitni amount receive hui?`);
  if (!input) return;

  const amount = parseFloat(input);
  if (isNaN(amount) || amount <= 0) {
    alert("Sahi amount daalein.");
    return;
  }

  const res = await fetch(`/api/sales/${id}/add-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });

  if (!res.ok) {
    const data = await res.json();
    alert(data.error || "Failed.");
    return;
  }
  reload();
}

async function voidSale(id: number, reload: () => void) {
  if (!window.confirm("Void this sale? Stock aur ledger reverse ho jayenge, record rahega.")) return;
  const res = await fetch(`/api/sales/${id}/void`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || "Failed.");
    return;
  }
  reload();
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [wheatTypes, setWheatTypes] = useState<WheatType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);

  const canAct = role === "owner" || role === "accountant";

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    customer_id: "",
    wheat_type_id: "",
    vehicle_no: "",
    net_weight_kg: "",
    rate_per_maund: "",
    freight_amount: "0",
    received_amount: "0",
  });

  async function loadData() {
    const [saleRes, cRes, wRes] = await Promise.all([
      fetch("/api/sales"),
      fetch("/api/customers"),
      fetch("/api/wheat-types"),
    ]);
    setSales(await saleRes.json());
    setCustomers(await cRes.json());
    setWheatTypes(await wRes.json());
  }

  useEffect(() => {
    loadData();
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((d) => setRole(d.role || null));
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        customer_id: parseInt(form.customer_id),
        wheat_type_id: parseInt(form.wheat_type_id),
        vehicle_no: form.vehicle_no,
        net_weight_kg: parseFloat(form.net_weight_kg),
        rate_per_maund: parseFloat(form.rate_per_maund),
        freight_amount: parseFloat(form.freight_amount) || 0,
        received_amount: parseFloat(form.received_amount) || 0,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Sale save nahi ho saka.");
      return;
    }

    setForm({ ...form, vehicle_no: "", net_weight_kg: "", rate_per_maund: "", freight_amount: "0", received_amount: "0" });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  const filtered = sales.filter(
    (s) =>
      s.voucher_no.toLowerCase().includes(search.toLowerCase()) ||
      s.customers.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Sales" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Wheat Sales"
          subtitle="Manage all sale invoices"
          action={<AddButton label="New Sale" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            <h3 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--tx-primary)" }}>
              New Sale Invoice
            </h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Customer</label>
                <select value={form.customer_id} onChange={(e) => update("customer_id", e.target.value)} className={inputClass} style={inputStyle} required>
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Wheat Type</label>
                <select value={form.wheat_type_id} onChange={(e) => update("wheat_type_id", e.target.value)} className={inputClass} style={inputStyle} required>
                  <option value="">Select...</option>
                  {wheatTypes.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Vehicle No.</label>
                <input value={form.vehicle_no} onChange={(e) => update("vehicle_no", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Net Weight (KG)</label>
                <input type="number" value={form.net_weight_kg} onChange={(e) => update("net_weight_kg", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Rate per Maund</label>
                <input type="number" value={form.rate_per_maund} onChange={(e) => update("rate_per_maund", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Freight Amount</label>
                <input type="number" value={form.freight_amount} onChange={(e) => update("freight_amount", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Received Amount</label>
                <input type="number" value={form.received_amount} onChange={(e) => update("received_amount", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save Sale
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-6 py-2 rounded-sm font-mono transition-colors" style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, customer..."
            className={`${inputClass} flex-1 min-w-50`}
            style={inputStyle}
          />
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>V. No.</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Wheat Type</th>
                  <th className="text-right">Maunds</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Received</th>
                  <th className="text-right">Remaining</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const status =
                    s.status === "voided"
                      ? "voided"
                      : statusOf(Number(s.received_amount), Number(s.remaining_amount));
                  return (
                    <tr key={s.id} style={s.status === "voided" ? { opacity: 0.5 } : {}}>
                      <td className="text-[#C9A227] font-semibold">{s.voucher_no}</td>
                      <td className="whitespace-nowrap">{new Date(s.date).toLocaleDateString()}</td>
                      <td style={{ color: "var(--tx-primary)" }}>{s.customers.name}</td>
                      <td>{s.wheat_types.name}</td>
                      <td className="text-right">{fmt(Number(s.maunds))}</td>
                      <td className="text-right">{fmtRs(Number(s.rate_per_maund))}</td>
                      <td className="text-right font-semibold" style={{ color: "var(--tx-primary)" }}>{fmtRs(Number(s.total_amount))}</td>
                      <td className="text-right text-emerald-400">{fmtRs(Number(s.received_amount))}</td>
                      <td className="text-right text-red-400">{Number(s.remaining_amount) > 0 ? fmtRs(Number(s.remaining_amount)) : "—"}</td>
                      <td><StatusBadge status={status} /></td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap">
                          <Link
                            href={`/sales/${s.id}/print`}
                            target="_blank"
                            className="font-mono text-[10px] text-[#C9A227] border border-[#C9A227]/30 hover:border-[#C9A227]/60 px-2 py-0.5 rounded-sm transition-colors"
                          >
                            PDF
                          </Link>
                                                    {canAct && s.status !== "voided" && (
                            <Link
                              href={`/sales/${s.id}/edit`}
                              className="font-mono text-[10px] text-sky-400 border border-sky-700/40 hover:border-sky-500/60 px-2 py-0.5 rounded-sm transition-colors"
                            >
                              Edit
                            </Link>
                          )}
                          {canAct && s.status !== "voided" && Number(s.remaining_amount) > 0 && (
                            <>
                              <button
                                onClick={() => addPayment(s.id, Number(s.remaining_amount), loadData)}
                                className="font-mono text-[10px] text-[#C9A227] border border-[#C9A227]/40 hover:border-[#C9A227]/60 px-2 py-0.5 rounded-sm transition-colors"
                              >
                                Add Payment
                              </button>
                              <button
                                onClick={() => markPaid(s.id, loadData)}
                                className="font-mono text-[10px] text-emerald-400 border border-emerald-700/40 hover:border-emerald-500/60 px-2 py-0.5 rounded-sm transition-colors"
                              >
                                Mark Paid
                              </button>
                            </>
                          )}
                          {canAct && s.status !== "voided" && (
                            <button
                              onClick={() => voidSale(s.id, loadData)}
                              className="font-mono text-[10px] text-red-400 border border-red-700/40 hover:border-red-500/60 px-2 py-0.5 rounded-sm transition-colors"
                            >
                              Void
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}