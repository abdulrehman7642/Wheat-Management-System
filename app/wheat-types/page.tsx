"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type Unit = { id: number; name: string };
type WheatType = {
  id: number;
  name: string;
  category: string | null;
  units: Unit | null;
};

export default function WheatTypesPage() {
  const [wheatTypes, setWheatTypes] = useState<WheatType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unitId, setUnitId] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    const [wtRes, unitsRes] = await Promise.all([
      fetch("/api/wheat-types"),
      fetch("/api/units"),
    ]);
    setWheatTypes(await wtRes.json());
    setUnits(await unitsRes.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/wheat-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        category,
        default_unit_id: parseInt(unitId),
      }),
    });

    if (!res.ok) {
      setError("Wheat type add nahi ho saka.");
      return;
    }

    setName("");
    setCategory("");
    setUnitId("");
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  return (
    <AppLayout title="Wheat Types" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Wheat Types"
          subtitle="Manage wheat categories and their default units"
          action={<AddButton label="New Wheat Type" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Private Wheat" className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Category</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="C" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Default Unit</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputClass} style={inputStyle} required>
                  <option value="">Select</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save Wheat Type
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
                  <th>Category</th>
                  <th>Default Unit</th>
                </tr>
              </thead>
              <tbody>
                {wheatTypes.map((wt) => (
                  <tr key={wt.id}>
                    <td className="font-semibold" style={{ color: "var(--tx-primary)" }}>{wt.name}</td>
                    <td>{wt.category}</td>
                    <td>{wt.units?.name}</td>
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