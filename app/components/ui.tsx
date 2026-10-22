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
      className="relative min-w-0 overflow-hidden rounded-sm p-4 sm:p-5"
      style={{ border: "1px solid var(--bd)", background: "var(--bg-card)" }}
    >
      <p
        className="font-mono text-[10px] tracking-[0.15em] uppercase mb-2"
        style={{ color: "var(--tx-muted)" }}
      >
        {label}
      </p>
      <p
        className="break-words font-display text-xl sm:text-2xl font-semibold"
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
      className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5"
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
    <div className="flex flex-col items-stretch justify-between gap-3 mb-5 sm:mb-6 sm:flex-row sm:items-start sm:gap-4">
      <div>
        <h2 className="break-words font-display text-xl sm:text-2xl font-semibold" style={{ color: "var(--tx-primary)" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="font-mono text-xs mt-0.5 tracking-wide" style={{ color: "var(--tx-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="w-full sm:w-auto sm:shrink-0">{action}</div>}
    </div>
  );
}

export function AddButton({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) {
  const className =
    "inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm min-h-11 w-full justify-center sm:w-auto px-4 py-2 rounded-sm transition-colors duration-200 font-mono tracking-wide";
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