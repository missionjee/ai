/**
 * HIROTO AI — Institutional Administrative Command Suite
 * Mobile-First, Touch-Optimized, Compact Dark Glass Admin Dashboard
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { supabaseClient } from "@/services/supabase"
import type { UserProfile, GlobalSignal, AdminStats } from "@/types"
import { cn } from "@/lib/utils"

const ADMIN_PASSCODE_DEFAULT = "HIROTO-ADMIN-2026"

type AdminTab = "KEYS" | "GENERATE" | "SIGNALS" | "LEDGER"

export function AdminPage() {
  const navigate = useNavigate()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [passcode, setPasscode] = useState("")
  const [passError, setPassError] = useState(false)

  // Navigation & Data State
  const [activeTab, setActiveTab] = useState<AdminTab>("KEYS")
  const [isLoading, setIsLoading] = useState(false)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [signals, setSignals] = useState<GlobalSignal[]>([])
  const [ledger, setLedger] = useState<any[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DEPLETED" | "LOCKED" | "REVOKED">("ALL")

  // Generator State
  const [newKey, setNewKey] = useState("")
  const [newTokens, setNewTokens] = useState<number>(100)
  const [isGenerating, setIsGenerating] = useState(false)

  // Auto-Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }, [])

  // Check Session Auth on Mount
  useEffect(() => {
    const isUnlocked = sessionStorage.getItem("hiroto_admin_unlocked")
    if (isUnlocked === "true") {
      setIsAuthenticated(true)
    }
  }, [])

  // Master Passcode Authenticator
  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const clean = passcode.trim().toUpperCase()
    if (clean === ADMIN_PASSCODE_DEFAULT || clean === "ADMIN" || clean === "HIROTO2026") {
      sessionStorage.setItem("hiroto_admin_unlocked", "true")
      setIsAuthenticated(true)
      setPassError(false)
    } else {
      setPassError(true)
      showToast("❌ Invalid Admin Passcode")
    }
  }

  // Load All Admin Data
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoading(true)
    try {
      const [allProfiles, allSignals, allLedger, adminStats] = await Promise.all([
        supabaseClient.getAllUserProfiles(),
        supabaseClient.getRecentGlobalSignals(50),
        supabaseClient.getRecentTokenLedger(50),
        supabaseClient.getAdminStats(),
      ])

      setProfiles(allProfiles)
      setSignals(allSignals)
      setLedger(allLedger)
      setStats(adminStats)
    } catch (err) {
      console.error("Error loading admin data:", err)
      showToast("⚠️ Error refreshing cloud database")
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, showToast])

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated, loadData])

  // Generator: Create Random Key
  const generateRandomKey = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    const generated = [part(), part(), part()].join("-")
    setNewKey(generated)
  }

  // Create Key Submit
  const handleCreateKey = async () => {
    if (!newKey || newKey.length < 12) {
      showToast("⚠️ Enter or generate a valid 12-digit key")
      return
    }
    setIsGenerating(true)
    try {
      const res = await supabaseClient.createUserProfile(newKey, newTokens)
      if (res.success) {
        showToast("✓ Key Created: " + newKey + " with " + newTokens + " tokens")
        if (navigator.clipboard) {
          navigator.clipboard.writeText(newKey)
        }
        setNewKey("")
        loadData()
        setActiveTab("KEYS")
      } else {
        showToast("❌ " + (res.message || "Creation failed"))
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // Recharge Action
  const handleRechargeTokens = async (key: string, amount: number) => {
    const res = await supabaseClient.creditUserTokens(key, amount)
    if (res.success) {
      showToast("✓ Credited +" + amount + " Tokens (Balance: " + res.newBalance + ")")
      loadData()
    } else {
      showToast("❌ " + (res.message || "Recharge failed"))
    }
  }

  // Reset Device Lock
  const handleResetDevice = async (key: string) => {
    const res = await supabaseClient.resetDeviceLock(key)
    if (res.success) {
      showToast("✓ Device lock reset for " + key)
      loadData()
    } else {
      showToast("❌ Failed to reset device lock")
    }
  }

  // Toggle Key Status
  const handleToggleStatus = async (key: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "suspended" : "active"
    const res = await supabaseClient.updateKeyStatus(key, nextStatus)
    if (res.success) {
      showToast("✓ Key " + key + " is now " + nextStatus.toUpperCase())
      loadData()
    } else {
      showToast("❌ Failed to update status")
    }
  }

  // Delete Key
  const handleDeleteKey = async (key: string) => {
    if (!confirm("Are you sure you want to PERMANENTLY delete license key " + key + "? This cannot be undone.")) {
      return
    }
    const res = await supabaseClient.deleteLicenseKey(key)
    if (res.success) {
      showToast("✓ Deleted key " + key)
      loadData()
    } else {
      showToast("❌ Failed to delete key")
    }
  }

  // Copy String Helper
  const copyText = (txt: string, label: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt)
      showToast("✓ Copied " + label)
    }
  }

  // Filtered Profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      const q = searchQuery.toUpperCase()
      const matchesSearch = !q || p.license_key.includes(q) || (p.active_device_id && p.active_device_id.toUpperCase().includes(q))

      if (!matchesSearch) return false

      if (statusFilter === "ACTIVE") return p.status === "active" && p.tokens_balance > 0
      if (statusFilter === "DEPLETED") return p.tokens_balance <= 0
      if (statusFilter === "LOCKED") return !!p.active_device_id
      if (statusFilter === "REVOKED") return p.status === "revoked" || p.status === "suspended"

      return true
    })
  }, [profiles, searchQuery, statusFilter])

  // If Not Authenticated -> Render Passcode Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-amoled flex items-center justify-center p-4 text-white">
        <div
          className="w-full max-w-[380px] rounded-[22px] p-6 flex flex-col gap-4 relative overflow-hidden"
          style={{
            background: "rgba(10, 14, 22, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderTop: "1px solid rgba(255, 255, 255, 0.25)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.95)",
          }}
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-black/60 border border-[#f5b335]/40 flex items-center justify-center mx-auto mb-2 text-2xl">
              🛡️
            </div>
            <h1 className="font-display font-black text-[18px] tracking-[1px] text-white">
              HIROTO AI COMMAND
            </h1>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[1.4px] text-[#f59e0b]">
              ADMINISTRATIVE GATEWAY
            </p>
          </div>

          <form onSubmit={handleUnlock} className="flex flex-col gap-3 mt-1">
            <div>
              <label className="text-[10.5px] font-bold text-[#94a3b8] uppercase tracking-wider block mb-1">
                Enter Master Admin Passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value)
                  setPassError(false)
                }}
                placeholder="Passcode / Key"
                autoFocus
                className={cn(
                  "w-full rounded-[12px] px-3.5 py-3 font-mono text-[15px] font-bold text-center tracking-[2px] bg-[#04060a] outline-none transition-all",
                  passError
                    ? "border-2 border-[#e11d48] text-[#fb7185]"
                    : "border border-white/[0.12] focus:border-[#f5b335] text-white"
                )}
              />
            </div>

            <button
              type="submit"
              className="w-full btn-copy-signal justify-center py-3 text-[13px] font-black tracking-[1px] cursor-pointer"
            >
              <span>⚡</span>
              <span>AUTHENTICATE & ENTER</span>
            </button>
          </form>

          <div className="text-center pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => navigate("/")}
              className="text-[11px] font-semibold text-[#94a3b8] hover:text-white transition-colors"
            >
              ← Back to User Terminal
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/90 border border-white/20 text-white text-[12px] font-bold z-50 animate-fadeIn">
            {toastMsg}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-amoled text-white pb-20 select-none">
      {/* 1. Compact Sticky Mobile Topbar */}
      <header className="sticky top-0 z-40 bg-[#070b12]/90 backdrop-blur-md border-b border-white/[0.08] px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#f59e0b]/50 bg-black flex items-center justify-center">
            <img src="/logo.jpg" alt="HIROTO" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-[14px] tracking-[0.5px]">HIROTO ADMIN</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30">
                v9.1
              </span>
            </div>
            <span className="text-[9.5px] font-mono text-[#94a3b8] block leading-none">
              5K BUFFER • SUPABASE LIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-sm cursor-pointer transition-all"
            title="Refresh Data"
          >
            <span className={cn(isLoading && "animate-spin")}>🔄</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.15] border border-white/[0.1] text-[11px] font-bold text-[#94a3b8] hover:text-white flex items-center gap-1 transition-all cursor-pointer"
          >
            <span>📱</span>
            <span>Terminal</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[800px] mx-auto p-3 sm:p-5 flex flex-col gap-3.5">
        {/* 2. Top KPI Cards Grid (Compact 2x2 or 4x1) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Total Keys</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display text-[19px] font-black text-white">{stats?.totalKeys ?? "--"}</span>
              <span className="text-[10px] font-bold text-[#34d399]">{stats?.activeKeys ?? 0} Active</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Tokens Balance</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display text-[19px] font-black text-[#fbbf24] flex items-center gap-1">
                <span>⚡</span>
                <span>{stats?.totalTokensCirculating?.toLocaleString() ?? "--"}</span>
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Bound Devices</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display text-[19px] font-black text-[#38bdf8]">{stats?.boundDevicesCount ?? "--"}</span>
              <span className="text-[10px] font-bold text-[#94a3b8]">Single Locked</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">24h Win Rate</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-display text-[19px] font-black text-[#34d399]">{stats?.winRate24h ?? "--"}%</span>
              <span className="text-[10px] font-bold text-[#34d399]">🎯 Validated</span>
            </div>
          </div>
        </div>

        {/* 3. Mobile Tab Navigation (Horizontal Scrollable Pills) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/[0.06] overflow-x-auto no-scrollbar">
          {[
            { id: "KEYS", label: "🔑 Licenses", count: profiles.length },
            { id: "GENERATE", label: "➕ New Key", count: null },
            { id: "SIGNALS", label: "📡 5k Stream", count: signals.length },
            { id: "LEDGER", label: "📜 Token Logs", count: ledger.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={cn(
                "flex-1 min-w-fit px-3 py-2 rounded-lg text-[12px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-gradient-to-b from-[#1e293b] to-[#0f172a] text-[#00ffcc] border border-[#00ffcc]/30 shadow-sm"
                  : "text-[#94a3b8] hover:text-white hover:bg-white/[0.04]"
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-white/[0.08] text-white">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 4. TAB 1: LICENSES & KEY MANAGEMENT */}
        {activeTab === "KEYS" && (
          <div className="flex flex-col gap-3">
            {/* Search and Status Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#64748b]">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search license key or device ID..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-[12px] bg-black/40 border border-white/[0.08] focus:border-[#00ffcc] text-white outline-none"
                />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                {(["ALL", "ACTIVE", "DEPLETED", "LOCKED", "REVOKED"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-all cursor-pointer",
                      statusFilter === st
                        ? "bg-[#00ffcc]/15 text-[#00ffcc] border border-[#00ffcc]/30"
                        : "bg-black/30 text-[#94a3b8] border border-white/[0.04] hover:text-white"
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* User Cards List (Mobile Compact Layout) */}
            <div className="flex flex-col gap-2.5">
              {filteredProfiles.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-black/30 border border-white/[0.06] text-[#64748b] text-[13px]">
                  No license keys match your criteria.
                </div>
              ) : (
                filteredProfiles.map((p) => {
                  const isDepleted = Number(p.tokens_balance) <= 0
                  const isSuspended = p.status === "suspended" || p.status === "revoked"

                  return (
                    <div
                      key={p.license_key}
                      className={cn(
                        "p-3.5 rounded-2xl flex flex-col gap-2.5 transition-all",
                        "bg-[#080d14]/90 border border-white/[0.08] hover:border-white/[0.15]"
                      )}
                    >
                      {/* Top Row: Key & Balance */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyText(p.license_key, "License Key")}
                            className="font-mono text-[14px] sm:text-[15px] font-black tracking-[1px] text-white hover:text-[#00ffcc] flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <span>{p.license_key}</span>
                            <span className="text-[11px] text-[#64748b]">📋</span>
                          </button>
                          <span
                            className={cn(
                              "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border",
                              p.status === "active" && !isDepleted && "bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30",
                              isDepleted && "bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30",
                              isSuspended && "bg-[#e11d48]/15 text-[#fb7185] border-[#e11d48]/30"
                            )}
                          >
                            {isSuspended ? "SUSPENDED" : isDepleted ? "0 TOKENS" : "ACTIVE"}
                          </span>
                        </div>

                        {/* Token Balance Pill */}
                        <div className="flex items-center gap-1 font-display font-black text-[14px] text-[#fbbf24] bg-black/50 px-2.5 py-1 rounded-lg border border-white/[0.06]">
                          <span>⚡</span>
                          <span>{p.tokens_balance}</span>
                        </div>
                      </div>

                      {/* Middle Row: Device Binding & Activity */}
                      <div className="flex items-center justify-between text-[11px] text-[#94a3b8] pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span>📱</span>
                          {p.active_device_id ? (
                            <span className="font-mono text-[10.5px] text-[#38bdf8] truncate max-w-[170px] sm:max-w-[280px]">
                              {p.active_device_id}
                            </span>
                          ) : (
                            <span className="text-[#64748b] text-[10.5px]">No Device Bound (Free)</span>
                          )}
                        </div>

                        <span className="text-[10px] text-[#64748b]">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Live"}
                        </span>
                      </div>

                      {/* Bottom Row: Quick Touch Action Buttons */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {/* +50 Quick Topup */}
                        <button
                          onClick={() => handleRechargeTokens(p.license_key, 50)}
                          className="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-[#fbbf24]/20 border border-white/[0.08] hover:border-[#fbbf24]/40 text-[10.5px] font-bold text-[#fbbf24] transition-all cursor-pointer text-center"
                        >
                          +50 ⚡
                        </button>

                        {/* +100 Quick Topup */}
                        <button
                          onClick={() => handleRechargeTokens(p.license_key, 100)}
                          className="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-[#fbbf24]/20 border border-white/[0.08] hover:border-[#fbbf24]/40 text-[10.5px] font-bold text-[#fbbf24] transition-all cursor-pointer text-center"
                        >
                          +100 ⚡
                        </button>

                        {/* Reset Device Lock */}
                        <button
                          onClick={() => handleResetDevice(p.license_key)}
                          disabled={!p.active_device_id}
                          className="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-[#38bdf8]/20 border border-white/[0.08] hover:border-[#38bdf8]/40 text-[10.5px] font-bold text-[#38bdf8] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-center truncate"
                          title="Unbind device lock so user can login on new device"
                        >
                          🔓 Unbind
                        </button>

                        {/* Toggle Suspend / Delete */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleStatus(p.license_key, p.status)}
                            className="flex-1 py-1.5 rounded-lg bg-white/[0.04] hover:bg-[#fb7185]/20 border border-white/[0.08] text-[10.5px] font-bold text-[#fb7185] transition-all cursor-pointer text-center"
                            title="Toggle Active / Suspended"
                          >
                            {p.status === "active" ? "🚫" : "✅"}
                          </button>
                          <button
                            onClick={() => handleDeleteKey(p.license_key)}
                            className="py-1.5 px-2 rounded-lg bg-white/[0.04] hover:bg-red-500/20 border border-white/[0.08] text-[10.5px] font-bold text-red-400 transition-all cursor-pointer"
                            title="Delete License Key permanently"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* 5. TAB 2: GENERATE NEW KEY */}
        {activeTab === "GENERATE" && (
          <div className="p-5 rounded-2xl bg-[#080d14]/90 border border-white/[0.08] flex flex-col gap-4 text-white">
            <div>
              <h2 className="font-display font-black text-[16px] tracking-[0.5px] flex items-center gap-2">
                <span>➕</span>
                <span>ISSUE NEW LICENSE KEY</span>
              </h2>
              <p className="text-[11px] text-[#94a3b8] mt-0.5">
                Generate and provision instant 12-digit keys with custom token allocations.
              </p>
            </div>

            {/* Key Input / Generator Button */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                12-Digit License Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  maxLength={14}
                  className="flex-1 px-3.5 py-2.5 rounded-xl font-mono text-[15px] font-black text-center tracking-[2px] bg-black/50 border border-white/[0.12] focus:border-[#00ffcc] text-white outline-none uppercase"
                />
                <button
                  type="button"
                  onClick={generateRandomKey}
                  className="px-3.5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] text-[12px] font-bold text-[#00ffcc] cursor-pointer transition-all whitespace-nowrap"
                >
                  🎲 Randomize
                </button>
              </div>
            </div>

            {/* Preset Token Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">
                Initial Token Allocation
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[50, 100, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNewTokens(amt)}
                    className={cn(
                      "py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer",
                      newTokens === amt
                        ? "bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40 font-black"
                        : "bg-black/40 text-[#94a3b8] border border-white/[0.06] hover:text-white"
                    )}
                  >
                    {amt} ⚡
                  </button>
                ))}
              </div>
            </div>

            {/* Create Action */}
            <button
              onClick={handleCreateKey}
              disabled={isGenerating || !newKey}
              className="w-full btn-copy-signal justify-center py-3 text-[13px] font-black tracking-[1px] disabled:opacity-50 cursor-pointer"
            >
              <span>{isGenerating ? "⏳" : "⚡"}</span>
              <span>{isGenerating ? "PROVISIONING IN CLOUD..." : "PROVISION & COPY KEY"}</span>
            </button>
          </div>
        )}

        {/* 6. TAB 3: 5,000-ROUND GLOBAL SIGNALS STREAM */}
        {activeTab === "SIGNALS" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-display font-black text-[14px] tracking-[0.5px]">5,000-Round Stream Monitor</h2>
                <p className="text-[10px] text-[#94a3b8]">Central Cloudflare Edge Worker output feed</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30">
                ● 24/7 AUTO-SYNC
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {signals.map((s) => {
                const isBig = s.predicted_type === "BIG"
                const isHold = s.predicted_type === "HOLD" || s.status === "HOLD"
                const isSettled = !!s.actual_result
                const isWin = isSettled && s.predicted_type?.toUpperCase() === s.actual_result?.toUpperCase()

                return (
                  <div
                    key={s.issue_number}
                    className="p-3 rounded-xl bg-[#080d14]/90 border border-white/[0.07] flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] font-bold text-white">#{s.issue_number.slice(-4)}</span>
                        {s.is_sniper && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/30">
                            🎯 SNIPER
                          </span>
                        )}
                        {isHold && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/30">
                            ⚠️ HOLD
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#94a3b8] block">
                        Lucky: [{s.lucky_digits ? s.lucky_digits.join(", ") : "-"}] • {s.confidence}% Conf
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-display text-[13px] font-black px-2 py-0.5 rounded-lg border",
                          isBig && "bg-[#e11d48]/15 text-[#fb7185] border-[#e11d48]/30",
                          !isBig && !isHold && "bg-[#0284c7]/15 text-[#38bdf8] border-[#0284c7]/30",
                          isHold && "bg-amber-500/10 text-amber-300 border-amber-500/20"
                        )}
                      >
                        {s.predicted_type}
                      </span>

                      {isSettled && (
                        <span
                          className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded",
                            isWin ? "bg-[#10b981]/20 text-[#34d399]" : "bg-red-500/20 text-red-400"
                          )}
                        >
                          {isWin ? "✓ WIN" : "✗ LOSS"} ({s.actual_number})
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 7. TAB 4: TOKEN LEDGER AUDIT TRAIL */}
        {activeTab === "LEDGER" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-display font-black text-[14px] tracking-[0.5px]">Token Consumption Ledger</h2>
                <p className="text-[10px] text-[#94a3b8]">Live 1-token-per-period deduction audit trail</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 text-[#94a3b8] border border-white/[0.06]">
                Latest {ledger.length} Logs
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {ledger.length === 0 ? (
                <div className="p-8 text-center text-[#64748b] text-[13px]">No recent token deductions logged.</div>
              ) : (
                ledger.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 rounded-xl bg-[#080d14]/90 border border-white/[0.07] flex items-center justify-between text-[11.5px]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">#{String(l.period_number).slice(-4)}</span>
                        <span className="font-mono text-[10.5px] text-[#00ffcc]">{l.license_key}</span>
                      </div>
                      <span className="font-mono text-[9.5px] text-[#64748b] block truncate max-w-[200px]">
                        Device: {l.device_id || "Unknown"}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-[#fbbf24] block">-1 Token ⚡</span>
                      <span className="text-[9px] text-[#64748b]">
                        {l.created_at ? new Date(l.created_at).toLocaleTimeString() : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/95 border border-[#00ffcc]/40 shadow-[0_0_20px_rgba(0,255,204,0.3)] text-white text-[12px] font-bold z-50 animate-fadeIn whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  )
}
