"use client";

import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader } from "../components/ui";

const reports = [
  { href: "/reports/outstanding", label: "Outstanding Balances", desc: "Receivables & Payables by party" },
  { href: "/purchases", label: "Purchase Register", desc: "All purchase vouchers" },
  { href: "/sales", label: "Sales Register", desc: "All sale invoices" },
  { href: "/inventory", label: "Stock Report", desc: "Current wheat stock by type" },
  { href: "/cash-book", label: "Cash Report", desc: "Cash in/out history" },
  { href: "/bank-book", label: "Bank Report", desc: "Bank in/out history" },
  { href: "/expenses", label: "Expense Report", desc: "All recorded expenses" },
];

export default function ReportsHubPage() {
  return (
    <AppLayout title="Reports" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Reports Hub" subtitle="All business reports in one place" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((r) => (
            <Link key={r.href} href={r.href}>
              <Card className="p-5 h-full hover:opacity-90 transition">
                <p className="font-display text-base font-semibold" style={{ color: "var(--tx-primary)" }}>
                  {r.label}
                </p>
                <p className="font-mono text-xs mt-1" style={{ color: "var(--tx-muted)" }}>
                  {r.desc}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}