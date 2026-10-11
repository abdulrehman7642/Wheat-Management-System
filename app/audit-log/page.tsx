"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader } from "../components/ui";

type LogRow = {
  id: number;
  user: string;
  action: string;
  record_type: string;
  record_id: number | null;
  created_at: string;
};

export default function AuditLogPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/audit-logs")
      .then((res) => res.json())
      .then(setRows);
  }, []);

  const q = search.toLowerCase();
  const filtered = rows.filter(
    (r) =>
      r.user.toLowerCase().includes(q) ||
      r.action.toLowerCase().includes(q) ||
      r.record_type.toLowerCase().includes(q)
  );

  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };

  return (
    <AppLayout title="Audit Log" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Audit Log" subtitle="Recent activity across the system" />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user, action, record..."
          className="w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono mb-4"
          style={inputStyle}
        />

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Record Type</th>
                  <th>Record ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td style={{ color: "var(--tx-primary)" }}>{r.user}</td>
                    <td className="capitalize text-[#C9A227]">{r.action.replace(/_/g, " ")}</td>
                    <td className="capitalize">{r.record_type.replace(/_/g, " ")}</td>
                    <td>{r.record_id || "-"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center" style={{ color: "var(--tx-muted)" }}>
                      Koi activity record nahi mila.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}