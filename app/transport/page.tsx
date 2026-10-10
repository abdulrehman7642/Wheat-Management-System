"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type Transport = {
  id: number;
  voucher_no: string;
  date: string;
  drivers: { name: string } | null;
  vehicles: { vehicle_no: string } | null;
  book_no: string | null;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
};

const fmtRs = (n: number) => `Rs. ${new Intl.NumberFormat("en-PK").format(Math.round(n))}`;

export default function TransportPage() {
  const [rows, setRows] = useState<Transport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    driver_name: "",
    vehicle_no: "",
    book_no: "",
    source: "",
    destination: "",
    total_amount: "",
    paid_amount: "0",
  });

  async function loadData() {
    const res = await fetch("/api/transport");
    setRows(await res.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/transport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        driver_name: form.driver_name || undefined,
        vehicle_no: form.vehicle_no || undefined,
        book_no: form.book_no || undefined,
        source: form.source || undefined,
        destination: form.destination || undefined,
        total_amount: parseFloat(form.total_amount),
        paid_amount: parseFloat(form.paid_amount) || 0,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Freight entry save nahi ho saki.");
      return;
    }

    setForm({ ...form, driver_name: "", vehicle_no: "", book_no: "", source: "", destination: "", total_amount: "", paid_amount: "0" });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  return (
    <AppLayout title="Transport" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Transport / Freight"
          subtitle="Carriage payments to drivers"
          action={<AddButton label="New Entry" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Driver Name</label>
                <input value={form.driver_name} onChange={(e) => update("driver_name", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Vehicle No.</label>
                <input value={form.vehicle_no} onChange={(e) => update("vehicle_no", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Book No. (optional)</label>
                <input value={form.book_no} onChange={(e) => update("book_no", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Source</label>
                <input value={form.source} onChange={(e) => update("source", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Destination</label>
                <input value={form.destination} onChange={(e) => update("destination", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Total Amount</label>
                <input type="number" value={form.total_amount} onChange={(e) => update("total_amount", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Paid Amount</label>
                <input type="number" value={form.paid_amount} onChange={(e) => update("paid_amount", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-6 py-2 rounded-sm font-mono transition-colors" style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th>Book No.</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Paid</th>
                  <th className="text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[#C9A227] font-semibold">{r.voucher_no}</td>
                    <td>{new Date(r.date).toLocaleDateString()}</td>
                    <td style={{ color: "var(--tx-primary)" }}>{r.drivers?.name || "-"}</td>
                    <td>{r.vehicles?.vehicle_no || "-"}</td>
                    <td>{r.book_no || "-"}</td>
                    <td className="text-right">{fmtRs(Number(r.total_amount))}</td>
                    <td className="text-right text-emerald-400">{fmtRs(Number(r.paid_amount))}</td>
                    <td className="text-right text-red-400">{Number(r.remaining_amount) > 0 ? fmtRs(Number(r.remaining_amount)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}