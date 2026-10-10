"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function WheatEmblem({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#C9A227" />
          <stop offset="100%" stopColor="#94771C" />
        </linearGradient>
        <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#152744" />
          <stop offset="100%" stopColor="#071020" />
        </linearGradient>
      </defs>
      {/* Outer Border with Gold Stroke */}
      <circle cx="32" cy="32" r="30" fill="url(#circleGrad)" stroke="url(#goldGrad)" strokeWidth="2" />
      <circle cx="32" cy="32" r="26" stroke="#C9A227" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 2" />
      {/* Center Stalk */}
      <path d="M32 48V20" stroke="url(#goldGrad)" strokeWidth="2" strokeLinecap="round" />
      {/* Central Top Grain */}
      <path d="M32 14C30 17 30 20 32 23C34 20 34 17 32 14Z" fill="url(#goldGrad)" />
      {/* Grains Left & Right */}
      {/* Tier 1 */}
      <path d="M32 24C28 22 25 24 24 27C27 28 30 27 32 25Z" fill="url(#goldGrad)" />
      <path d="M32 24C36 22 39 24 40 27C37 28 34 27 32 25Z" fill="url(#goldGrad)" />
      {/* Tier 2 */}
      <path d="M32 29C27 27 23 30 22 33C25 34 29 33 32 30Z" fill="url(#goldGrad)" />
      <path d="M32 29C37 27 41 30 42 33C39 34 35 33 32 30Z" fill="url(#goldGrad)" />
      {/* Tier 3 */}
      <path d="M32 34C27 32 23 35 21 39C25 40 29 39 32 36Z" fill="url(#goldGrad)" />
      <path d="M32 34C37 32 41 35 43 39C39 40 35 39 32 36Z" fill="url(#goldGrad)" />
      {/* Bottom Garland Curve */}
      <path d="M22 45C26 47 30 46 32 44C34 46 38 47 42 45" stroke="url(#goldGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Galat username ya password.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Server connection error. Please try again.");
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#071020] text-[#F5F0E8] overflow-hidden selection:bg-[#C9A227]/30 selection:text-white">
      {/* LEFT PANEL: Showcase Hero (Desktop & Tablet) */}
      <div className="hidden lg:relative lg:flex lg:w-[56%] xl:w-[60%] flex-col justify-between p-12 overflow-hidden">
        {/* Background Image Container with Fallback - NO <img> tag to avoid stray alt text */}
        <div
          className="absolute inset-0 z-0 bg-[#071020] bg-cover bg-center transition-transform duration-1000 ease-out"
          style={{
            backgroundImage: "url('/login-hero.jpg')",
          }}
          role="presentation"
          aria-hidden="true"
        >
          {/* Multi-layer Gradient Scrim for Contrast & Elegance */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#071020] via-[#071020]/75 to-[#071020]/35" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#071020]/45 to-[#071020]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#C9A227]/15 via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Top Header / Branding with SVG Emblem */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="shrink-0 p-0.5 rounded-full shadow-lg shadow-black/40">
              <WheatEmblem size={44} />
            </div>
            <div>
              <span className="block font-display text-lg font-semibold tracking-wide text-[#F5F0E8]">
                MALIK YASEEN & CO.
              </span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-[#C9A227] font-mono">
                Grain Commodities & Mills
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ERP System Online</span>
          </div>
        </div>

        {/* Center Hero Editorial Copy */}
        <div className="relative z-10 max-w-xl my-auto py-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-[#C9A227]/15 border border-[#C9A227]/30 text-[#C9A227] text-xs font-mono tracking-wider uppercase">
            <span>🌾 Modern Agri-Trade Management</span>
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-[#F5F0E8] mb-6">
            Intelligent Grain Trading, Fleet & Real-time Ledgers.
          </h1>
          <p className="text-[#A3B3D2] text-base leading-relaxed mb-8">
            Integrated accounting, inventory valuation, gate pass tracking, and
            supplier credit books engineered for Pakistan&apos;s wheat and commodity trade.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div className="p-3 rounded-lg bg-black/30 backdrop-blur-md border border-white/5">
              <div className="text-[#C9A227] font-mono text-sm mb-1 font-semibold">99.9%</div>
              <div className="text-xs text-[#8A9EB8]">Ledger Accuracy</div>
            </div>
            <div className="p-3 rounded-lg bg-black/30 backdrop-blur-md border border-white/5">
              <div className="text-[#C9A227] font-mono text-sm mb-1 font-semibold">Instant</div>
              <div className="text-xs text-[#8A9EB8]">Vehicle In/Out</div>
            </div>
            <div className="p-3 rounded-lg bg-black/30 backdrop-blur-md border border-white/5">
              <div className="text-[#C9A227] font-mono text-sm mb-1 font-semibold">Secure</div>
              <div className="text-xs text-[#8A9EB8]">Role-based Access</div>
            </div>
          </div>
        </div>

        {/* Bottom Legal / Watermark */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#6B7DA8] font-mono">
          <span>© {new Date().getFullYear()} Malik Yaseen & Co.</span>
          <span>v2.4 Enterprise Edition</span>
        </div>
      </div>

      {/* RIGHT PANEL: Auth Card Form */}
      <div className="w-full lg:w-[44%] xl:w-[40%] flex flex-col justify-between p-6 sm:p-10 md:p-12 bg-[#0A1628] border-l border-[#1E3454]/60 relative">
        {/* Subtle Ambient Glow Effect */}
        <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-[#C9A227]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Mobile Header (Hidden on Desktop) */}
        <div className="lg:hidden flex items-center justify-between mb-8 pb-4 border-b border-[#1E3454]">
          <div className="flex items-center gap-3">
            <WheatEmblem size={36} />
            <div>
              <span className="block font-display text-base font-semibold text-[#F5F0E8]">
                MALIK YASEEN & CO.
              </span>
              <span className="block text-[10px] text-[#C9A227] font-mono uppercase tracking-wider">
                Grain ERP
              </span>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>

        {/* Login Form Container */}
        <div className="my-auto w-full max-w-sm mx-auto">
          {/* Header Brand Lockup: Clean "Malik Yaseen & Co." + Welcome Back */}
          <div className="text-center mb-8">
            <div className="inline-flex p-2.5 rounded-full bg-[#0F1E36] border border-[#C9A227]/40 shadow-[0_0_25px_rgba(201,162,39,0.15)] mb-3.5">
              <WheatEmblem size={46} />
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-[#F5F0E8] via-[#F3EAD8] to-[#C9A227] bg-clip-text text-transparent">
              Malik Yaseen & Co.
            </h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#C9A227] font-mono mt-1">
              Grain Commodities & Trading ERP
            </p>

            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-[#C9A227]/60 to-transparent mx-auto my-3.5" />

            <h3 className="font-display text-lg font-semibold text-[#F5F0E8]">
              Welcome Back
            </h3>
            <p className="text-xs text-[#8A9EB8] mt-1">
              Enter your credentials to access the ERP dashboard
            </p>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-6 p-3.5 rounded-md bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <svg
                className="w-4 h-4 text-rose-400 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label className="block text-xs uppercase tracking-wider font-mono text-[#8A9EB8] mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7DA8]">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[#11213B] border border-[#1E3454] text-[#F5F0E8] placeholder-[#4B5E7D] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs uppercase tracking-wider font-mono text-[#8A9EB8]">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6B7DA8]">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-2.5 rounded-md bg-[#11213B] border border-[#1E3454] text-[#F5F0E8] placeholder-[#4B5E7D] text-sm focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6B7DA8] hover:text-[#C9A227] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 relative group overflow-hidden rounded-md py-3 px-4 font-mono font-medium text-sm text-[#071020] bg-gradient-to-r from-[#C9A227] via-[#DFB738] to-[#E8C84A] hover:from-[#DFB738] hover:to-[#F5D86C] shadow-[0_4px_20px_rgba(201,162,39,0.25)] hover:shadow-[0_4px_25px_rgba(201,162,39,0.4)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-[#071020]"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to System</span>
                    <span className="font-sans transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Security Badge */}
          <div className="mt-8 pt-6 border-t border-[#1E3454]/60 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono text-[#6B7DA8]">
              <svg
                className="w-3.5 h-3.5 text-[#C9A227]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>256-Bit SSL Encrypted Enterprise Portal</span>
            </div>
          </div>
        </div>

        {/* Footer info for Right Panel */}
        <div className="text-center text-[11px] text-[#4B5E7D] font-mono mt-8">
          Authorized personnel only • Activity is monitored and logged
        </div>
      </div>
    </div>
  );
}