"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "../../../components/AppLayout";
import { SectionHeader } from "../../../components/ui";

type Option = { id: number; name: string };

export default function EditSalePage() {
  const params = useParams();
  const router = useRouter();
  const [customers, setCustomers] = useState<Option[]>([]);
  const [wheatTypes, setWheatTypes] = useState<Option[]>([]);
  const [voucher, setVoucher] = useState("");
  const [received, setReceived] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    date: "",
    customer_id: "",
    wheat_type_id: "",
    vehicle_no: "",
    net_weight_kg: "",
    rate_per_maund: "",
    freight_amount: "",
  });

  useEffect(() => {
    async function load() {
      const [sRes, cRes, wRes] = await Promise.all([
        fetch(`/api/sales/${params.id}`),
        fetch("/api/customers"),
        fetch("/api/wheat-types?all=1"),
      ]);
      const s = await sRes.json();
      setCustomers(await cRes.json());
      setWheatTypes(await wRes.json());
      setVoucher(s.voucher_no);
      setReceived(Number(s.received_amount));
      const n = (v: unknown) => String(Number(v));
      setForm({
        date: String(s.date).slice(0, 10),
        customer_id: String(s.customer_id),
        wheat_type_id: String(s.wheat_type_id),
        vehicle_no: s.vehicles?.vehicle_no || "",
        net_weight_kg: n(s.net_weight_kg),
        rate_per_maund: n(s.rate_per_maund),
        freight_amount: n(s.freight_amount),
      });
    }
    load();
  }, [params.id]);

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch(`/api/sales/${params.id}/replace`, {
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
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Edit save nahi ho saka.");
      return;
    }
    router.push("/sales");
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  const num = (label: string, key: string, required = false) => (
    <div>
      <label className={labelClass} style={{ color: "var(--tx-muted)" }}>{label}</label>
      <input
        type="number"
        step="any"
        value={form[key]}
        onChange={(e) => update(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
        required={required}
      />
    </div>
  );

  return (
    <AppLayout title="Edit Sale" subtitle="">
      <div className="fade-in">
        <SectionHeader title={`Edit ${voucher}`} subtitle="Purani voucher cancel hogi aur nayi voucher banegi" />

        <form
          onSubmit={handleSubmit}
          className="rounded-sm p-6"
          style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
        >
          <p className="font-mono text-xs mb-4" style={{ color: "var(--tx-muted)" }}>
            Pehle mili hui rakam (Rs. {received.toLocaleString()}) nayi voucher mein khud aage chali jayegi.
          </p>
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
            {num("Net Weight (KG)", "net_weight_kg", true)}
            {num("Rate / Maund (Rs.)", "rate_per_maund", true)}
            {num("Freight Amount", "freight_amount")}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Edit"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/sales")}
              className="text-sm px-6 py-2 rounded-sm font-mono"
              style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}