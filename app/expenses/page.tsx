"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type Category = { id: number; name: string };
type Expense = {
  id: number;
  voucher_no: string;
  date: string;
  amount: string;
  method: string;
  description: string | null;
  expense_categories: { name: string };
};

const fmtRs = (n: number) => `Rs. ${new Intl.NumberFormat("en-PK").format(Math.round(n))}`;

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category_id: "",
    amount: "",
    method: "cash",
    description: "",
  });

  async function loadData() {
    const [eRes, cRes] = await Promise.all([
      fetch("/api/expenses"),
      fetch("/api/expense-categories"),
    ]);
    setExpenses(await eRes.json());
    setCategories(await cRes.json());
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

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: form.date,
        category_id: parseInt(form.category_id),
        amount: parseFloat(form.amount),
        method: form.method,
        description: form.description || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Expense save nahi ho saka.");
      return;
    }

    setForm({ ...form, category_id: "", amount: "", description: "" });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  return (
    <AppLayout title="Expenses" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Expenses"
          subtitle="Track business operating expenses"
          action={<AddButton label="New Expense" onClick={() => setShowForm(!showForm)} />}
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
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Category</label>
                <select value={form.category_id} onChange={(e) => update("category_id", e.target.value)} className={inputClass} style={inputStyle} required>
                  <option value="">Select</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
              <div className="sm:col-span-2">
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Description (optional)</label>
                <input value={form.description} onChange={(e) => update("description", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save Expense
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
                  <th>Category</th>
                  <th>Method</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="text-[#C9A227] font-semibold">{e.voucher_no}</td>
                    <td>{new Date(e.date).toLocaleDateString()}</td>
                    <td style={{ color: "var(--tx-primary)" }}>{e.expense_categories.name}</td>
                    <td className="capitalize">{e.method}</td>
                    <td style={{ color: "var(--tx-secondary)" }}>{e.description}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--tx-primary)" }}>
                      {fmtRs(Number(e.amount))}
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