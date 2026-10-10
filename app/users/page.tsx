"use client";

import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader, AddButton } from "../components/ui";

type User = {
  id: number;
  username: string;
  full_name: string | null;
  status: string;
  role: string;
  last_login_at: string | null;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    role_name: "data_entry",
  });

  async function loadData() {
    const res = await fetch("/api/users");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    setUsers(await res.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "User create nahi ho saka.");
      return;
    }

    setForm({ username: "", password: "", full_name: "", role_name: "data_entry" });
    setShowForm(false);
    loadData();
  }

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  if (forbidden) {
    return (
      <AppLayout title="Users" subtitle="">
        <p style={{ color: "var(--tx-muted)" }}>
          Ye page sirf Owner access kar sakta hai.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Users" subtitle="">
      <div className="fade-in">
        <SectionHeader
          title="Users & Roles"
          subtitle="Manage who can access the system"
          action={<AddButton label="New User" onClick={() => setShowForm(!showForm)} />}
        />

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-sm p-6"
            style={{ border: "1px solid rgba(201,162,39,0.3)", background: "var(--bg-card)" }}
          >
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Username</label>
                <input value={form.username} onChange={(e) => update("username", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Password</label>
                <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} className={inputClass} style={inputStyle} required />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Full Name</label>
                <input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Role</label>
                <select value={form.role_name} onChange={(e) => update("role_name", e.target.value)} className={inputClass} style={inputStyle}>
                  <option value="data_entry">Data Entry Operator</option>
                  <option value="accountant">Accountant</option>
                  <option value="owner">Owner / Admin</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors">
                Create User
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm px-6 py-2 rounded-sm font-mono transition-colors" style={{ border: "1px solid var(--bd)", color: "var(--tx-muted)" }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full ledger-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold" style={{ color: "var(--tx-primary)" }}>{u.username}</td>
                    <td>{u.full_name}</td>
                    <td className="capitalize text-[#C9A227]">{u.role.replace("_", " ")}</td>
                    <td className="capitalize">{u.status}</td>
                    <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}