"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader } from "../components/ui";

type Row = {
  id: number;
  voucher_no: string;
  date: string;
  description: string;
  in: number;
  out: number;
  balance: number;
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));

export default function CashBookPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/cash-book")
      .then((res) => res.json())
      .then(setRows);
  }, []);

  const closing = rows.length > 0 ? rows[rows.length - 1].balance : 0;
  const totalIn = rows.reduce((s, r) => s + r.in, 0);
  const totalOut = rows.reduce((s, r) => s + r.out, 0);

  return (
    <AppLayout title="Cash Book" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Cash Book" subtitle="All cash payments and receipts" />

        <Card>
          <div className="table-scroll">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>V. No.</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th className="text-right">In</th>
                  <th className="text-right">Out</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[#C9A227] font-semibold">{r.voucher_no}</td>
                    <td className="whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                    <td style={{ color: "var(--tx-secondary)" }}>{r.description}</td>
                    <td className="text-right text-emerald-400">{r.in > 0 ? fmt(r.in) : "-"}</td>
                    <td className="text-right text-red-400">{r.out > 0 ? fmt(r.out) : "-"}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--tx-primary)" }}>{fmt(r.balance)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center" style={{ color: "var(--tx-muted)" }}>
                      Koi cash transaction nahi mila.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "1px solid rgba(201,162,39,0.3)" }}>
                    <td colSpan={3} className="px-4 py-3 font-mono text-xs uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>
                      Closing Balance
                    </td>
                    <td className="text-right px-4 py-3 font-mono text-sm text-emerald-400">{fmt(totalIn)}</td>
                    <td className="text-right px-4 py-3 font-mono text-sm text-red-400">{fmt(totalOut)}</td>
                    <td className="text-right px-4 py-3 font-mono text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>{fmt(closing)}</td>
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