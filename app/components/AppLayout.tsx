"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";

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
  { href: "/company-growth", label: "Company Growth", icon: "↗", roles: ["owner"] },
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
      className="flex min-h-11 w-full items-center justify-center gap-1 px-2.5 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-wider border"
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpen = useRef(false);

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
    if (!mobileOpen) {
      if (wasMobileOpen.current) {
        requestAnimationFrame(() => menuButtonRef.current?.focus());
        wasMobileOpen.current = false;
      }
      return;
    }

    wasMobileOpen.current = true;
    const scrollY = window.scrollY;
    const original = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = original.overflow;
      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.width = original.width;
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  async function handleLogout() {
    setMobileOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const visibleItems = navItems.filter((item) => !role || item.roles.includes(role));

  const sidebarContent = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-4 pt-[calc(1rem+env(safe-area-inset-top))] md:p-5" style={{ borderColor: "var(--bd)" }}>
        <WheatLogo />
        <button
          ref={closeButtonRef}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="min-h-11 min-w-11 text-xl leading-none md:hidden"
          style={{ color: "var(--tx-muted)" }}
        >
          ✕
        </button>
      </div>

      <nav aria-label="Primary navigation" className="sidebar-navigation flex-1 min-h-0 overflow-y-auto overscroll-contain py-2 sm:py-3">
        {visibleItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex min-h-11 items-center gap-3 px-4 py-2 text-sm font-medium transition sm:px-5 sm:py-2.5"
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

      <footer className="shrink-0 space-y-2.5 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:space-y-3 md:p-4" style={{ borderColor: "var(--bd)" }}>
        {username && (
          <p className="font-mono text-[10px]" style={{ color: "var(--tx-muted)" }}>
            {username} · <span className="capitalize text-[#C9A227]">{role?.replace("_", " ")}</span>
          </p>
        )}
        <Link
          href="/change-password"
          onClick={() => setMobileOpen(false)}
          className="flex min-h-11 w-full items-center justify-center rounded border px-4 py-2 text-center text-sm font-medium"
          style={{ borderColor: "var(--bd)", color: "var(--tx-muted)" }}
        >
          Change Password
        </Link>
        <ThemeToggle />
        <button
          onClick={handleLogout}
          className="min-h-11 w-full rounded border px-4 py-2 text-sm font-medium"
          style={{ borderColor: "var(--bd)", color: "var(--tx-muted)" }}
        >
          Logout
        </button>
      </footer>
    </>
  );

  return (
    <div className="flex min-h-screen min-w-0" style={{ background: "var(--bg-page)" }}>
      {/* Mobile top bar */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex min-h-16 items-center justify-between px-3 sm:px-4 py-3 border-b"
        style={{ background: "var(--bg-sidebar)", borderColor: "var(--bd)" }}
      >
        <button
          ref={menuButtonRef}
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
        className={`app-sidebar fixed top-0 z-50 flex w-[min(16rem,calc(100vw-1rem))] shrink-0 flex-col border-r transition-transform duration-200 md:sticky md:w-60 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
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
