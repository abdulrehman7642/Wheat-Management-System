"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../../components/AppLayout";
import { Card, SectionHeader } from "../../components/ui";

type Row = { id: number; name: string; code: string; balance: number };

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));

export default function OutstandingReportPage() {
  const [suppliers, setSuppliers] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/reports/outstanding")
      .then((res) => res.json())
      .then((data) => {
        setSuppliers(data.supplierRows || []);
        setCustomers(data.customerRows || []);
      });
  }, []);

  const totalPayable = suppliers.reduce((s, r) => s + (r.balance > 0 ? r.balance : 0), 0);
  const totalReceivable = customers.reduce((s, r) => s + (r.balance > 0 ? r.balance : 0), 0);

  return (
    <AppLayout title="Outstanding Balances" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Outstanding Balances" subtitle="Suppliers you owe, customers who owe you" />

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--bd)" }}>
              <h3 className="font-display text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>
                Payable to Suppliers
              </h3>
            </div>
            <div className="table-scroll">
              <table className="w-full ledger-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Supplier</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td className="text-[#C9A227] font-semibold">{s.code}</td>
                      <td>
                        <Link href={`/suppliers/${s.id}`} className="hover:underline" style={{ color: "var(--tx-primary)" }}>
                          {s.name}
                        </Link>
                      </td>
                      <td className="text-right font-semibold" style={{ color: s.balance > 0 ? "#f87171" : "#34d399" }}>
                        {fmt(Math.abs(s.balance))} {s.balance >= 0 ? "Cr" : "Dr"}
                      </td>
                    </tr>
                  ))}
                  {suppliers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center" style={{ color: "var(--tx-muted)" }}>
                        Koi outstanding balance nahi.
                      </td>
                    </tr>
                  )}
                </tbody>
                {suppliers.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "1px solid rgba(201,162,39,0.3)" }}>
                      <td colSpan={2} className="px-4 py-3 font-mono text-xs uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>
                        Total Payable
                      </td>
                      <td className="text-right px-4 py-3 font-mono text-sm font-semibold text-red-400">{fmt(totalPayable)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-3.5" style={{ borderBottom: "1px solid var(--bd)" }}>
              <h3 className="font-display text-sm font-semibold" style={{ color: "var(--tx-primary)" }}>
                Receivable from Customers
              </h3>
            </div>
            <div className="table-scroll">
              <table className="w-full ledger-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Customer</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td className="text-[#C9A227] font-semibold">{c.code}</td>
                      <td>
                        <Link href={`/customers/${c.id}`} className="hover:underline" style={{ color: "var(--tx-primary)" }}>
                          {c.name}
                        </Link>
                      </td>
                      <td className="text-right font-semibold" style={{ color: c.balance > 0 ? "#34d399" : "#f87171" }}>
                        {fmt(Math.abs(c.balance))} {c.balance >= 0 ? "Dr" : "Cr"}
                      </td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center" style={{ color: "var(--tx-muted)" }}>
                        Koi outstanding balance nahi.
                      </td>
                    </tr>
                  )}
                </tbody>
                {customers.length > 0 && (
                  <tfoot>
                    <tr style={{ borderTop: "1px solid rgba(201,162,39,0.3)" }}>
                      <td colSpan={2} className="px-4 py-3 font-mono text-xs uppercase tracking-wider" style={{ color: "var(--tx-muted)" }}>
                        Total Receivable
                      </td>
                      <td className="text-right px-4 py-3 font-mono text-sm font-semibold text-emerald-400">{fmt(totalReceivable)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}