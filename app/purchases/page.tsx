"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton, StatusBadge } from "../components/ui";

type Supplier = { id: number; code: string; name: string };
type WheatType = { id: number; name: string };
type Purchase = {
  id: number;
  voucher_no: string;
  date: string;
  suppliers: { name: string };
  wheat_types: { name: string };
  vehicles: { vehicle_no: string } | null;
  maunds: string;
  rate_per_maund: string;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: string;
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));
const fmtRs = (n: number) => `Rs. ${fmt(n)}`;

function statusOf(paid: number, remaining: number) {
  if (remaining <= 0) return "paid";
  if (paid > 0) return "partial";
  return "pending";
}

async function markPaid(id: number, reload: () => void) {
  if (!window.confirm("Mark this purchase as fully paid?")) return;
  const res = await fetch(`/api/purchases/${id}/mark-paid`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || "Failed.");
    return;
  }
  reload();
}

async function addPayment(id: number, remaining: number, reload: () => void) {
  const input = window.prompt(`Remaining: Rs. ${remaining}. Kitni amount pay ki?`);
  if (!input) return;

  const amount = parseFloat(input);
  if (isNaN(amount) || amount <= 0) {
    alert("Sahi amount daalein.");
    return;
  }

  const res = await fetch(`/api/purchases/${id}/add-payment`, {
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

async function voidPurchase(id: number, reload: () => void) {
  if (!window.confirm("Void this purchase? Stock aur ledger reverse ho jayenge, record rahega.")) return;
  const res = await fetch(`/api/purchases/${id}/void`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    alert(data.error || "Failed.");
    return;
  }
  reload();
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [wheatTypes, setWheatTypes] = useState<WheatType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);

  const canAct = role === "owner" || role === "accountant";

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplier_id: "",
    wheat_type_id: "",
    vehicle_no: "",
    bag_count: "",
    gross_weight_kg: "",
    bags_weight_kg: "",
    extra_weight_kg: "0",
    rate_per_maund: "",
    wheat_tax_amount: "0",
    kanta_charges: "0",
    unloading_charges: "0",
    bags_amount: "0",
    paid_amount: "0",
  });

  async function loadData() {
    const [pRes, sRes, wRes] = await Promise.all([
      fetch("/api/purchases"),
      fetch("/api/suppliers"),
      fetch("/api/wheat-types"),
    ]);
    setPurchases(await pRes.json());
    setSuppliers(await sRes.json());
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

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        supplier_id: parseInt(form.supplier_id),
        wheat_type_id: parseInt(form.wheat_type_id),
        vehicle_no: form.vehicle_no,
        bag_count: parseInt(form.bag_count) || 0,
        gross_weight_kg: parseFloat(form.gross_weight_kg),
        bags_weight_kg: parseFloat(form.bags_weight_kg) || 0,
        extra_weight_kg: parseFloat(form.extra_weight_kg) || 0,
        rate_per_maund: parseFloat(form.rate_per_maund),
        wheat_tax_amount: parseFloat(form.wheat_tax_amount) || 0,
        kanta_charges: parseFloat(form.kanta_charges) || 0,
        unloading_charges: parseFloat(form.unloading_charges) || 0,
        bags_amount: parseFloat(form.bags_amount) || 0,
        paid_amount: parseFloat(form.paid_amount) || 0,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Purchase save nahi ho saka.");
      return;
    }

    setForm({
      ...form,
      vehicle_no: "",
      bag_count: "",
      gross_weight_kg: "",
      bags_weight_kg: "",
      extra_weight_kg: "0",
      rate_per_maund: "",
      wheat_tax_amount: "0",
      kanta_charges: "0",
      unloading_charges: "0",
      bags_amount: "0",
      paid_amount: "0",
    });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  const filtered = purchases.filter(
    (p) =>
      p.voucher_no.toLowerCase().includes(search.toLowerCase()) ||
      p.suppliers.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalMaunds = filtered.reduce((a, p) => a + Number(p.maunds), 0);
  const totalAmount = filtered.reduce((a, p) => a + Number(p.total_amount), 0);
  const totalPaid = filtered.reduce((a, p) => a + Number(p.paid_amount), 0);
  const totalRemaining = filtered.reduce((a, p) => a + Number(p.remaining_amount), 0);

  return (
    <AppLayout title="Purchases" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Wheat Purchases"
          subtitle="Manage all wheat purchase vouchers"
          action={<AddButton label="New Purchase" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            <h3 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--tx-primary)" }}>
              New Purchase Voucher
            </h3>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Supplier</label>
                <select value={form.supplier_id} onChange={(e) => update("supplier_id", e.target.value)} className={inputClass} style={inputStyle} required>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
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
                <input value={form.vehicle_no} onChange={(e) => update("vehicle_no", e.target.value)} placeholder="EA-7328" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>No. of Bags</label>
                <input type="number" value={form.bag_count} onChange={(e) => update("bag_count", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>

            <div className="mb-4" style={{ borderTop: "1px solid var(--bd)", paddingTop: "1rem" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#C9A227] mb-3">Weight Details</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Gross Weight (KG)</label>
                  <input type="number" value={form.gross_weight_kg} onChange={(e) => update("gross_weight_kg", e.target.value)} className={inputClass} style={inputStyle} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Bags Weight (KG)</label>
                  <input type="number" value={form.bags_weight_kg} onChange={(e) => update("bags_weight_kg", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Extra Weight (KG)</label>
                  <input type="number" value={form.extra_weight_kg} onChange={(e) => update("extra_weight_kg", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
              </div>
            </div>

            <div className="mb-4" style={{ borderTop: "1px solid var(--bd)", paddingTop: "1rem" }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#C9A227] mb-3">Pricing & Charges</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Rate / Maund (Rs.)</label>
                  <input type="number" value={form.rate_per_maund} onChange={(e) => update("rate_per_maund", e.target.value)} className={inputClass} style={inputStyle} required />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Wheat Tax</label>
                  <input type="number" value={form.wheat_tax_amount} onChange={(e) => update("wheat_tax_amount", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Kanta Charges</label>
                  <input type="number" value={form.kanta_charges} onChange={(e) => update("kanta_charges", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Unloading Charges</label>
                  <input type="number" value={form.unloading_charges} onChange={(e) => update("unloading_charges", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Bags Amount</label>
                  <input type="number" value={form.bags_amount} onChange={(e) => update("bags_amount", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Paid Amount</label>
                  <input type="number" value={form.paid_amount} onChange={(e) => update("paid_amount", e.target.value)} className={inputClass} style={inputStyle} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save Purchase
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
            placeholder="Search voucher, supplier..."
            className={`${inputClass} flex-1 min-w-[200px]`}
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
                  <th>Supplier</th>
                  <th>Wheat Type</th>
                  <th>Vehicle</th>
                  <th className="text-right">Maunds</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Remaining</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status =
                    p.status === "voided"
                      ? "voided"
                      : statusOf(Number(p.paid_amount), Number(p.remaining_amount));
                  return (
                    <tr key={p.id} style={p.status === "voided" ? { opacity: 0.5 } : {}}>
                      <td className="text-[#C9A227] font-semibold">{p.voucher_no}</td>
                      <td className="whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                      <td style={{ color: "var(--tx-primary)" }}>{p.suppliers.name}</td>
                      <td>{p.wheat_types.name}</td>
                      <td>{p.vehicles?.vehicle_no || "-"}</td>
                      <td className="text-right">{fmt(Number(p.maunds))}</td>
                      <td className="text-right">{fmtRs(Number(p.rate_per_maund))}</td>
                      <td className="text-right font-semibold" style={{ color: "var(--tx-primary)" }}>{fmtRs(Number(p.total_amount))}</td>
                      <td className="text-right text-emerald-400">{fmtRs(Number(p.paid_amount))}</td>
                      <td className="text-right text-red-400">{Number(p.remaining_amount) > 0 ? fmtRs(Number(p.remaining_amount)) : "—"}</td>
                      <td><StatusBadge status={status} /></td>
                      <td>
                        <div className="flex gap-1.5 flex-wrap">
                          <Link
                            href={`/purchases/${p.id}/print`}
                            target="_blank"
                            className="font-mono text-[10px] text-[#C9A227] border border-[#C9A227]/30 hover:border-[#C9A227]/60 px-2 py-0.5 rounded-sm transition-colors"
                          >
                            PDF
                          </Link>
                          {canAct && p.status !== "voided" && Number(p.remaining_amount) > 0 && (
                            <>
                              <button
                                onClick={() => addPayment(p.id, Number(p.remaining_amount), loadData)}
                                className="font-mono text-[10px] text-[#C9A227] border border-[#C9A227]/40 hover:border-[#C9A227]/60 px-2 py-0.5 rounded-sm transition-colors"
                              >
                                Add Payment
                              </button>
                              <button
                                onClick={() => markPaid(p.id, loadData)}
                                className="font-mono text-[10px] text-emerald-400 border border-emerald-700/40 hover:border-emerald-500/60 px-2 py-0.5 rounded-sm transition-colors"
                              >
                                Mark Paid
                              </button>
                            </>
                          )}
                          {canAct && p.status !== "voided" && (
                            <button
                              onClick={() => voidPurchase(p.id, loadData)}
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
              <tfoot>
                <tr style={{ borderTop: "1px solid rgba(201,162,39,0.3)" }}>
                  <td colSpan={5} className="px-4 py-3 font-mono text-xs uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>
                    Total ({filtered.length} records)
                  </td>
                  <td className="text-right px-4 py-3 font-mono text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>{fmt(totalMaunds)}</td>
                  <td />
                  <td className="text-right px-4 py-3 font-mono text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>{fmtRs(totalAmount)}</td>
                  <td className="text-right px-4 py-3 font-mono text-sm text-emerald-400">{fmtRs(totalPaid)}</td>
                  <td className="text-right px-4 py-3 font-mono text-sm text-red-400">{fmtRs(totalRemaining)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}