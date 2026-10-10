"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type BagType = {
  id: number;
  name: string;
  size_kg: string | null;
  category: string | null;
};

export default function BagsPage() {
  const [rows, setRows] = useState<BagType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    bag_type: "",
    size_kg: "",
  });

  async function loadData() {
    const res = await fetch("/api/bags");
    setRows(await res.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/bags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        bag_type: form.bag_type,
        size_kg: form.size_kg ? parseFloat(form.size_kg) : undefined,
        quantity: 1,
        rate: 0,
      }),
    });

    if (!res.ok) {
      setError("Bag type add nahi ho saka.");
      return;
    }

    setForm({ bag_type: "", size_kg: "" });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  return (
    <AppLayout title="Bags" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Bags / Packaging"
          subtitle="Manage bag types used in purchases"
          action={<AddButton label="New Bag Type" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Bag Type Name</label>
                <input
                  value={form.bag_type}
                  onChange={(e) => setForm({ ...form, bag_type: e.target.value })}
                  placeholder="Jute, PP/Plastic..."
                  className={inputClass}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Bag Size (KG)</label>
                <input
                  type="number"
                  value={form.size_kg}
                  onChange={(e) => setForm({ ...form, size_kg: e.target.value })}
                  placeholder="100"
                  className={inputClass}
                  style={inputStyle}
                />
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
                  <th>Name</th>
                  <th className="text-right">Size (KG)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold" style={{ color: "var(--tx-primary)" }}>{r.name}</td>
                    <td className="text-right">{r.size_kg || "-"}</td>
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