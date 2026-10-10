"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader } from "../components/ui";

type VoucherPrefix = { doc_type: string; prefix: string; current_number: number };

const docTypeLabels: Record<string, string> = {
  wheat_purchase: "Wheat Purchase",
  wheat_sale: "Wheat Sale",
  cash_payment: "Cash Payment",
  bank_withdrawal: "Bank Withdrawal",
  bank_deposit: "Bank Deposit",
  journal: "Journal / Reversal",
};

export default function SettingsPage() {
  const [company, setCompany] = useState({ name: "", address: "", phone: "", city: "" });
  const [prefixes, setPrefixes] = useState<VoucherPrefix[]>([]);
  const [savedMsg, setSavedMsg] = useState("");

  async function loadData() {
    const cRes = await fetch("/api/settings/company");
    const pRes = await fetch("/api/settings/voucher-prefixes");
    setCompany(await cRes.json());
    setPrefixes(await pRes.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/settings/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(company),
    });
    setSavedMsg("Company info saved.");
    setTimeout(() => setSavedMsg(""), 2000);
  }

  async function savePrefix(docType: string, prefix: string) {
    await fetch("/api/settings/voucher-prefixes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc_type: docType, prefix: prefix }),
    });
    loadData();
  }

    async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      "Are you sure? Yeh current data replace kar dega. Pehle apna current backup download kar lein agar nahi kiya."
    );
    if (!confirmed) {
      input.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed.data }),
      });

      const raw = await res.text();
      let message = raw;
      try {
        message = JSON.parse(raw).error || raw;
      } catch {}

      if (res.ok) {
        alert("Restore successful.");
        window.location.reload();
      } else {
        alert("Restore failed (" + res.status + "): " + message.slice(0, 300));
      }
    } catch (err) {
      alert("Restore failed: " + (err instanceof Error ? err.message : String(err)));
    }

    input.value = "";
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";
  const goldButtonClass = "bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors";

  return (
    <AppLayout title="Settings" subtitle="">
      <div className="fade-in space-y-6">
        <SectionHeader title="Settings" subtitle="Company info and voucher numbering" />

        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--tx-primary)" }}>
            Company Information
          </h3>
          <form onSubmit={saveCompany} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>
                Company Name
              </label>
              <input
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>
                Phone
              </label>
              <input
                value={company.phone}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>
                City
              </label>
              <input
                value={company.city}
                onChange={(e) => setCompany({ ...company, city: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>
                Address
              </label>
              <input
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="submit" className={goldButtonClass}>
                Save
              </button>
              {savedMsg ? <span className="text-emerald-400 text-sm font-mono">{savedMsg}</span> : null}
            </div>
          </form>
        </Card>

        <Card>
          <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--bd)" }}>
            <h3 className="font-display text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>
              Voucher Numbering
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Prefix</th>
                  <th className="text-right">Current Number</th>
                </tr>
              </thead>
              <tbody>
                {prefixes.map((p) => (
                  <tr key={p.doc_type}>
                    <td style={{ color: "var(--tx-primary)" }}>
                      {docTypeLabels[p.doc_type] || p.doc_type}
                    </td>
                    <td>
                      <input
                        defaultValue={p.prefix}
                        onBlur={(e) => {
                          if (e.target.value !== p.prefix) {
                            savePrefix(p.doc_type, e.target.value);
                          }
                        }}
                        className="rounded-sm px-2 py-1 text-sm font-mono w-24"
                        style={inputStyle}
                      />
                    </td>
                    <td className="text-right">{p.current_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display text-lg font-semibold mb-2" style={{ color: "var(--tx-primary)" }}>
            Backup
          </h3>
          <p className="font-mono text-xs mb-4" style={{ color: "var(--tx-muted)" }}>
            Download a full JSON export of your business data.
          </p>
          <a href="/api/backup/export" className={goldButtonClass + " inline-block"}>
            Download Backup
          </a>

          <div className="mt-6 pt-6" style={{ borderTop: "1px solid var(--bd)" }}>
            <p className="font-mono text-xs mb-3" style={{ color: "var(--tx-muted)" }}>
              Restore from a backup file. This will replace current suppliers, customers, purchases, sales, ledgers, and payments.
            </p>
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFile}
              className="text-sm font-mono"
              style={{ color: "var(--tx-secondary)" }}
            />
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}