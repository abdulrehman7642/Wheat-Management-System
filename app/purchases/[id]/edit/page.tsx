"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "../../../components/AppLayout";
import { SectionHeader } from "../../../components/ui";

type Option = { id: number; name: string };

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [wheatTypes, setWheatTypes] = useState<Option[]>([]);
  const [voucher, setVoucher] = useState("");
  const [paid, setPaid] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    date: "",
    supplier_id: "",
    wheat_type_id: "",
    vehicle_no: "",
    bag_count: "",
    gross_weight_kg: "",
    bags_weight_kg: "",
    extra_weight_kg: "",
    rate_per_maund: "",
    wheat_tax_amount: "",
    kanta_charges: "",
    unloading_charges: "",
    bags_amount: "",
  });

  useEffect(() => {
    async function load() {
      const [pRes, sRes, wRes] = await Promise.all([
        fetch(`/api/purchases/${params.id}`),
        fetch("/api/suppliers"),
        fetch("/api/wheat-types?all=1"),
      ]);
      const p = await pRes.json();
      setSuppliers(await sRes.json());
      setWheatTypes(await wRes.json());
      setVoucher(p.voucher_no);
      setPaid(Number(p.paid_amount));
      const n = (v: unknown) => String(Number(v));
      setForm({
        date: String(p.date).slice(0, 10),
        supplier_id: String(p.supplier_id),
        wheat_type_id: String(p.wheat_type_id),
        vehicle_no: p.vehicles?.vehicle_no || "",
        bag_count: n(p.bag_count),
        gross_weight_kg: n(p.gross_weight_kg),
        bags_weight_kg: n(p.bags_weight_kg),
        extra_weight_kg: n(p.extra_weight_kg),
        rate_per_maund: n(p.rate_per_maund),
        wheat_tax_amount: n(p.wheat_tax_amount),
        kanta_charges: n(p.kanta_charges),
        unloading_charges: n(p.unloading_charges),
        bags_amount: n(p.bags_amount),
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

    const res = await fetch(`/api/purchases/${params.id}/replace`, {
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
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "Edit save nahi ho saka.");
      return;
    }
    router.push("/purchases");
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
    <AppLayout title="Edit Purchase" subtitle="">
      <div className="fade-in">
        <SectionHeader title={`Edit ${voucher}`} subtitle="Purani voucher cancel hogi aur nayi voucher banegi" />

        <form
          onSubmit={handleSubmit}
          className="rounded-sm p-6"
          style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
        >
          <p className="font-mono text-xs mb-4" style={{ color: "var(--tx-muted)" }}>
            Pehle di hui payment (Rs. {paid.toLocaleString()}) nayi voucher mein khud aage chali jayegi.
          </p>
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
              <input value={form.vehicle_no} onChange={(e) => update("vehicle_no", e.target.value)} className={inputClass} style={inputStyle} />
            </div>
            {num("No. of Bags", "bag_count")}
          </div>

          <div className="mb-4" style={{ borderTop: "1px solid var(--bd)", paddingTop: "1rem" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#C9A227] mb-3">Weight Details</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {num("Gross Weight (KG)", "gross_weight_kg", true)}
              {num("Bags Weight (KG)", "bags_weight_kg")}
              {num("Extra Weight (KG)", "extra_weight_kg")}
            </div>
          </div>

          <div className="mb-4" style={{ borderTop: "1px solid var(--bd)", paddingTop: "1rem" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#C9A227] mb-3">Pricing & Charges</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {num("Rate / Maund (Rs.)", "rate_per_maund", true)}
              {num("Wheat Tax", "wheat_tax_amount")}
              {num("Kanta Charges", "kanta_charges")}
              {num("Unloading Charges", "unloading_charges")}
              {num("Bags Amount", "bags_amount")}
            </div>
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
              onClick={() => router.push("/purchases")}
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