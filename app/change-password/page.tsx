"use client";

import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { Card, SectionHeader } from "../components/ui";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const inputClass = "w-full rounded-sm px-3 py-2 text-sm focus:outline-none font-mono";
  const inputStyle = { background: "var(--bg-input)", border: "1px solid var(--bd)", color: "var(--tx-primary)" };
  const labelClass = "block font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Naya password aur confirm password match nahi karte.");
      return;
    }

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Password change nahi ho saka.");
      return;
    }

    setSuccess("Password successfully change ho gaya.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <AppLayout title="Change Password" subtitle="">
      <div className="fade-in">
        <SectionHeader title="Change Password" subtitle="Update your login password" />

        <Card className="p-6 max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-emerald-400 text-sm">{success}</p>}

            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                style={inputStyle}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--tx-muted)" }}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                style={inputStyle}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="bg-[#C9A227] hover:bg-[#E8C84A] text-[#0A1628] font-semibold text-sm px-6 py-2 rounded-sm font-mono tracking-wide transition-colors"
            >
              Update Password
            </button>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
}