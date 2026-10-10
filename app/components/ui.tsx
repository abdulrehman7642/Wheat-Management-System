"use client";

import { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-sm p-5"
      style={{ border: "1px solid var(--bd)", background: "var(--bg-card)" }}
    >
      <p
        className="font-mono text-[10px] tracking-[0.15em] uppercase mb-2"
        style={{ color: "var(--tx-muted)" }}
      >
        {label}
      </p>
      <p
        className="font-display text-2xl font-semibold"
        style={{ color: "var(--tx-primary)" }}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`font-mono text-xs mt-1 ${
            positive === false ? "text-red-400" : positive ? "text-emerald-400" : ""
          }`}
          style={!positive && positive !== false ? { color: "var(--tx-muted)" } : {}}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-sm ${className}`}
      style={{ border: "1px solid var(--bd)", background: "var(--bg-card)" }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-3.5"
      style={{ borderBottom: "1px solid var(--bd)" }}
    >
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-900/60 text-emerald-400 border border-emerald-700/40",
    received: "bg-emerald-900/60 text-emerald-400 border border-emerald-700/40",
    partial: "bg-amber-900/60 text-amber-400 border border-amber-700/40",
    pending: "bg-red-900/60 text-red-400 border border-red-700/40",
  };
  return (
    <span
      className={`font-mono text-[10px] px-2 py-0.5 rounded-sm uppercase tracking-wider ${
        map[status] || ""
      }`}
    >
      {status}
    </span>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
      <div>
        <h2 className="font-display text-2xl font-semibold" style={{ color: "var(--tx-primary)" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="font-mono text-xs mt-0.5 tracking-wide" style={{ color: "var(--tx-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AddButton({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) {
  const className =
    "inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-4 py-2 rounded-sm transition-colors duration-200 font-mono tracking-wide";
  if (href) {
    return (
      <a href={href} className={className}>
        <span className="text-lg leading-none">+</span>
        {label}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      <span className="text-lg leading-none">+</span>
      {label}
    </button>
  );
}