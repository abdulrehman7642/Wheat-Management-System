"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "◈", roles: ["owner", "accountant", "data_entry"] },
  { href: "/purchases", label: "Purchases", icon: "↓", roles: ["owner", "accountant", "data_entry"] },
  { href: "/sales", label: "Sales", icon: "↑", roles: ["owner", "accountant", "data_entry"] },
  { href: "/inventory", label: "Inventory", icon: "⊟", roles: ["owner", "accountant", "data_entry"] },
  { href: "/customers", label: "Customers", icon: "◎", roles: ["owner", "accountant", "data_entry"] },
  { href: "/suppliers", label: "Suppliers", icon: "◉", roles: ["owner", "accountant", "data_entry"] },
  { href: "/payments", label: "Payments", icon: "₨", roles: ["owner", "accountant"] },
  { href: "/cash-book", label: "Cash Book", icon: "≡", roles: ["owner", "accountant"] },
  { href: "/bank-book", label: "Bank Book", icon: "≡", roles: ["owner", "accountant"] },
  { href: "/expenses", label: "Expenses", icon: "⊖", roles: ["owner", "accountant"] },
  { href: "/wheat-types", label: "Wheat Types", icon: "⊞", roles: ["owner", "accountant"] },
  { href: "/reports", label: "Reports", icon: "▤", roles: ["owner", "accountant"] },
  { href: "/labor", label: "Labor", icon: "⚒", roles: ["owner", "accountant"] },
  { href: "/transport", label: "Transport", icon: "⛟", roles: ["owner", "accountant"] },
  { href: "/bags", label: "Bags", icon: "◰", roles: ["owner", "accountant"] },
  { href: "/settings", label: "Settings", icon: "⚙", roles: ["owner"] },
  { href: "/users", label: "Users", icon: "◈", roles: ["owner"] },
  { href: "/audit-log", label: "Audit Log", icon: "▤", roles: ["owner"] },
];

function WheatLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={32} height={32} viewBox="0 0 48 48" fill="none">
        <line x1="24" y1="44" x2="24" y2="10" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 10 Q28 4 32 3" stroke="#C9A227" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <ellipse cx="24" cy="14" rx="4.5" ry="7" fill="#C9A227" opacity="0.95" />
        <ellipse cx="17" cy="18" rx="3.5" ry="6" fill="#C9A227" opacity="0.75" transform="rotate(-18 17 18)" />
        <ellipse cx="31" cy="18" rx="3.5" ry="6" fill="#C9A227" opacity="0.75" transform="rotate(18 31 18)" />
      </svg>
      <div>
        <p className="font-display text-sm font-semibold leading-tight" style={{ color: "var(--tx-primary)" }}>
          Malik Yaseen
        </p>
        <p className="font-mono text-[10px] tracking-wider text-[#C9A227]">& Company</p>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "dark" | "light") || "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("light", saved === "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-wider border"
      style={{ borderColor: "var(--bd)", color: "var(--tx-muted)", background: "var(--bg-card)" }}
    >
      {theme === "dark" ? "☾ Dark" : "☀ Light"}
    </button>
  );
}

export default function AppLayout({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setRole(data.role || null);
        setUsername(data.username || "");
      });
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const visibleItems = navItems.filter((item) => !role || item.roles.includes(role));

  const sidebarContent = (
    <>
      <div className="p-5 border-b shrink-0 flex items-center justify-between" style={{ borderColor: "var(--bd)" }}>
        <WheatLogo />
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation" className="md:hidden min-h-11 min-w-11 text-xl leading-none"
          style={{ color: "var(--tx-muted)" }}
        >
          ✕
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)} className="flex min-h-11 items-center gap-3 px-5 py-2.5 text-sm font-medium transition"
              style={{
                background: active ? "var(--sidebar-active)" : "transparent",
                color: active ? "var(--gold)" : "var(--tx-muted)",
                borderRight: active ? "2px solid var(--gold)" : "2px solid transparent",
              }}
            >
              <span className="font-mono">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t shrink-0 space-y-3" style={{ borderColor: "var(--bd)" }}>
        {username && (
          <p className="font-mono text-[10px]" style={{ color: "var(--tx-muted)" }}>
            {username} · <span className="capitalize text-[#C9A227]">{role?.replace("_", " ")}</span>
          </p>
        )}
        <Link
          href="/change-password"
          className="block w-full text-center px-4 py-2 rounded text-sm font-medium border"
          style={{ borderColor: "var(--bd)", color: "var(--tx-muted)" }}
        >
          Change Password
        </Link>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 rounded text-sm font-medium border"
          style={{ borderColor: "var(--bd)", color: "var(--tx-muted)" }}
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-page)" }}>
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex min-h-16 items-center justify-between px-3 sm:px-4 py-3 border-b"
        style={{ background: "var(--bg-sidebar)", borderColor: "var(--bd)" }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation" className="min-h-11 min-w-11 text-2xl leading-none px-1"
          style={{ color: "var(--tx-primary)" }}
        >
          ☰
        </button>
        <WheatLogo />
        <div style={{ width: 24 }} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: desktop sticky, mobile slide-in drawer */}
      <aside
        className={`w-64 md:w-60 h-screen flex flex-col shrink-0 border-r fixed md:sticky top-0 z-50 transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        style={{ background: "var(--bg-sidebar)", borderColor: "var(--bd)" }}
      >
        {sidebarContent}
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-5 lg:p-8 pt-20 md:pt-8 w-full md:w-auto">
        {action && <div className="mb-6 flex w-full justify-stretch sm:justify-end">{action}</div>}
        {children}
      </main>
    </div>
  );
}