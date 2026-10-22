"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "../../components/AppLayout";
import { Card, SectionHeader } from "../../components/ui";

type Customer = { id: number; code: string; name: string; city: string | null; phone: string | null };
type LedgerEntry = {
  id: number;
  date: string;
  voucher_no: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));

export default function CustomerLedgerPage() {
  const params = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", city: "", phone: "" });
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/customers/${params.id}/ledger`);
    const data = await res.json();
    setCustomer(data.customer);
    setEntries(data.entries || []);
    if (data.customer) {
      setForm({
        code: data.customer.code,
        name: data.customer.name,
        city: data.customer.city || "",
        phone: data.customer.phone || "",
      });
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch(`/api/customers/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setError("Update nahi ho saka.");
      return;
    }

    setEditing(false);
    load();
  }

  const closingBalance = entries.length > 0 ? Number(entries[entries.length - 1].balance) : 0;
  const totalDebit = entries.reduce((sum, e) => sum + Number(e.debit), 0);
  const totalCredit = entries.reduce((sum, e) => sum + Number(e.credit), 0);

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  return (
    <AppLayout title="Customer Ledger" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title={customer ? `${customer.name} — Ledger` : "Customer Ledger"}
          subtitle={customer ? `${customer.code} · ${customer.city || ""}` : ""}
          action={
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className="text-sm px-4 py-2 rounded-sm font-mono transition-colors"
                style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}
              >
                {editing ? "Cancel" : "Edit"}
              </button>
              <Link
                href={`/customers/${params.id}/print`}
                target="_blank"
                className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-4 py-2 rounded-sm transition-colors font-mono tracking-wide"
              >
                Print / PDF
              </Link>
            </div>
          }
        />

        {editing && (
          <form
            onSubmit={handleSave}
            className="mb-6 rounded-sm p-4 sm:p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Code</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} />
              </div>
            </div>
            <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
              Save Changes
            </button>
          </form>
        )}

        <Card>
          <div className="table-scroll">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>V. No.</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-[#C9A227] font-semibold whitespace-nowrap">{e.voucher_no}</td>
                    <td className="whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="max-w-md" style={{ color: "var(--tx-secondary)" }}>{e.description}</td>
                    <td className="text-right">{Number(e.debit) > 0 ? fmt(Number(e.debit)) : "-"}</td>
                    <td className="text-right">{Number(e.credit) > 0 ? fmt(Number(e.credit)) : "-"}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--tx-primary)" }}>
                      {fmt(Math.abs(Number(e.balance)))} {Number(e.balance) >= 0 ? "Dr" : "Cr"}
                    </td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center" style={{ color: "var(--tx-muted)" }}>
                      Koi transaction nahi mila.
                    </td>
                  </tr>
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(201,162,39,0.3)" }}>
                    <td colSpan={3} className="px-4 py-3 font-mono text-xs uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>
                      Closing Balance
                    </td>
                    <td className="text-right px-4 py-3 font-mono text-sm">{fmt(totalDebit)}</td>
                    <td className="text-right px-4 py-3 font-mono text-sm">{fmt(totalCredit)}</td>
                    <td className="text-right px-4 py-3 font-mono text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>
                      {fmt(Math.abs(closingBalance))} {closingBalance >= 0 ? "Dr" : "Cr"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}