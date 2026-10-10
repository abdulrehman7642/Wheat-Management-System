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

  useEffect(() => {
    fetch("/api/audit-logs")
      .then((res) => res.json())
      .then(setRows);
  }, []);

  return (
    <AppLayout title="Audit Log" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Audit Log" subtitle="Recent activity across the system" />

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
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td style={{ color: "var(--tx-primary)" }}>{r.user}</td>
                    <td className="capitalize text-[#C9A227]">{r.action}</td>
                    <td className="capitalize">{r.record_type}</td>
                    <td>{r.record_id}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
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