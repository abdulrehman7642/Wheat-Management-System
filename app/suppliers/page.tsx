"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type Supplier = {
  id: number;
  code: string;
  name: string;
  city: string | null;
  phone: string | null;
  opening_balance: string;
};

const fmtRs = (n: number) => `Rs. ${new Intl.NumberFormat("en-PK").format(Math.round(n))}`;

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");

  async function loadSuppliers() {
    const res = await fetch("/api/suppliers");
    setSuppliers(await res.json());
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        city,
        phone,
        opening_balance: parseFloat(openingBalance) || 0,
      }),
    });

    if (!res.ok) {
      setError("Supplier add nahi ho saka. Code pehle se to nahi hai?");
      return;
    }

    setCode("");
    setName("");
    setCity("");
    setPhone("");
    setOpeningBalance("0");
    setShowForm(false);
    loadSuppliers();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout title="Suppliers" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Suppliers"
          subtitle="Wheat dealers you buy from"
          action={<AddButton label="New Supplier" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-4 sm:p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Code</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>City</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Opening Balance</label>
                <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={inputClass} style={inputStyle} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Save Supplier
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
            placeholder="Search name or code..."
            className={`${inputClass} flex-1 min-w-0 sm:min-w-[200px]`}
            style={inputStyle}
          />
        </div>

        <Card>
          <div className="table-scroll">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th className="text-right">Opening Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="text-[#C9A227] font-semibold">{s.code}</td>
                    <td>
                      <Link href={`/suppliers/${s.id}`} className="hover:underline" style={{ color: "var(--tx-primary)" }}>
                        {s.name}
                      </Link>
                    </td>
                    <td>{s.city}</td>
                    <td>{s.phone}</td>
                    <td className="text-right">{fmtRs(Number(s.opening_balance))}</td>
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