"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type Unit = { id: number; name: string };
type WheatType = {
  id: number;
  name: string;
  category: string | null;
  status: string;
  default_unit_id: number | null;
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

  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({ name: "", category: "", unitId: "", status: "active" });
  const [editError, setEditError] = useState("");

  async function loadData() {
    const [wtRes, unitsRes] = await Promise.all([
      fetch("/api/wheat-types?all=1"),
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
      body: JSON.stringify({ name, category, default_unit_id: parseInt(unitId) }),
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

  function startEdit(w: WheatType) {
    setEditId(w.id);
    setEditError("");
    setEdit({
      name: w.name,
      category: w.category || "",
      unitId: w.default_unit_id ? String(w.default_unit_id) : "",
      status: w.status,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");

    const res = await fetch(`/api/wheat-types/${editId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: edit.name,
        category: edit.category,
        default_unit_id: edit.unitId ? parseInt(edit.unitId) : undefined,
        status: edit.status,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setEditError(data.error || "Update nahi ho saka.");
      return;
    }

    setEditId(null);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";
  const goldBtn = "bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors";

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
              <button type="submit" className={goldBtn}>Save Wheat Type</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-6 py-2 rounded-sm font-mono" style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {editId !== null && (
          <form
            onSubmit={saveEdit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#C9A227] mb-3">Edit Wheat Type</p>
            {editError && <p className="text-red-400 text-sm mb-4">{editError}</p>}
            <div className="grid sm:grid-cols-4 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Name</label>
                <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Category</label>
                <input value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Default Unit</label>
                <select value={edit.unitId} onChange={(e) => setEdit({ ...edit, unitId: e.target.value })} className={inputClass} style={inputStyle}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Status</label>
                <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={inputClass} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (dropdown se hat jayegi)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className={goldBtn}>Save Changes</button>
              <button type="button" onClick={() => setEditId(null)} className="text-sm px-6 py-2 rounded-sm font-mono" style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}>
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
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {wheatTypes.map((wt) => (
                  <tr key={wt.id} style={wt.status !== "active" ? { opacity: 0.5 } : {}}>
                    <td className="font-semibold" style={{ color: "var(--tx-primary)" }}>{wt.name}</td>
                    <td>{wt.category}</td>
                    <td>{wt.units?.name}</td>
                    <td className="capitalize">{wt.status}</td>
                    <td>
                      <button
                        onClick={() => startEdit(wt)}
                        className="font-mono text-[10px] text-[#C9A227] border border-[#C9A227]/30 hover:border-[#C9A227]/60 px-2 py-0.5 rounded-sm transition-colors"
                      >
                        Edit
                      </button>
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