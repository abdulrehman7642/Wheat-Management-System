"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { KpiCard, SectionHeader } from "../components/ui";

type Stock = {
  wheat_type_id: number;
  name: string;
  category: string | null;
  balance_kg: number;
  balance_maunds: number;
};

const fmt = (n: number) => new Intl.NumberFormat("en-PK").format(Math.round(n));

export default function InventoryPage() {
  const [stock, setStock] = useState<Stock[]>([]);

  useEffect(() => {
    fetch("/api/inventory")
      .then((res) => res.json())
      .then(setStock);
  }, []);

  return (
    <AppLayout title="Inventory" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Wheat Inventory" subtitle="Real-time stock by wheat type" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stock.map((s) => (
            <KpiCard
              key={s.wheat_type_id}
              label={`${s.name}${s.category ? ` (${s.category})` : ""}`}
              value={`${fmt(s.balance_kg)} KG`}
              sub={`${s.balance_maunds.toFixed(2)} Maunds`}
            />
          ))}
          {stock.length === 0 && (
            <p style={{ color: "var(--tx-muted)" }}>Koi wheat type nahi mila.</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}