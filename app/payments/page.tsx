"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type Party = { id: number; name: string };
type Payment = {
  id: number;
  voucher_no: string;
  date: string;
  party_type: string;
  amount: string;
  method: string;
  description: string | null;
};

const fmtRs = (n: number) => `Rs. ${new Intl.NumberFormat("en-PK").format(Math.round(n))}`;

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    party_type: "supplier",
    party_id: "",
    amount: "",
    method: "cash",
    description: "",
  });

  async function loadData() {
    const [payRes, sRes, cRes] = await Promise.all([
      fetch("/api/payments"),
      fetch("/api/suppliers"),
      fetch("/api/customers"),
    ]);
    setPayments(await payRes.json());
    setSuppliers(await sRes.json());
    setCustomers(await cRes.json());
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

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        party_type: form.party_type,
        party_id: parseInt(form.party_id),
        amount: parseFloat(form.amount),
        method: form.method,
        description: form.description || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Payment save nahi ho saka.");
      return;
    }

    setForm({ ...form, party_id: "", amount: "", description: "" });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";
  const parties = form.party_type === "supplier" ? suppliers : customers;

  return (
    <AppLayout title="Payments" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Payments"
          subtitle="Pay suppliers or receive from customers"
          action={<AddButton label="New Payment" onClick={() => setShowForm(!showForm)} />}
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
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Type</label>
                <select
                  value={form.party_type}
                  onChange={(e) => {
                    update("party_type", e.target.value);
                    update("party_id", "");
                  }}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="supplier">Pay Supplier</option>
                  <option value="customer">Receive from Customer</option>
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>
                  {form.party_type === "supplier" ? "Supplier" : "Customer"}
                </label>
                <select value={form.party_id} onChange={(e) => update("party_id", e.target.value)} className={inputClass} style={inputStyle} required>
                  <option value="">Select</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Date</label>
                <input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Amount</label>
                <input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Method</label>
                <select value={form.method} onChange={(e) => update("method", e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Description (optional)</label>
                <input value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save Payment
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
                  <th>Type</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-[#C9A227] font-semibold">{p.voucher_no}</td>
                    <td>{new Date(p.date).toLocaleDateString()}</td>
                    <td className="capitalize" style={{ color: "var(--tx-primary)" }}>{p.party_type}</td>
                    <td className="capitalize">{p.method}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--tx-primary)" }}>
                      {fmtRs(Number(p.amount))}
                    </td>
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