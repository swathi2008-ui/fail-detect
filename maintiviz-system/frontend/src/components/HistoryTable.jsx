/**
 * HistoryTable — Filterable & searchable telemetry log browser
 * =============================================================
 * Displays the last 50 telemetry records with:
 *   - Dynamic risk badges with animated dot indicators
 *   - Risk level filter buttons
 *   - Timestamp + formatted sensor values
 *
 * Props:
 *   history  {Array}  Array of log objects from GET /api/telemetry/history
 *   loading  {boolean}
 */

import React, { useState, useMemo } from "react";
import { Database, Filter, Search } from "lucide-react";

const RISK_BADGE = {
  HEALTHY: "badge-healthy",
  WARNING: "badge-warning",
  CRITICAL: "badge-critical",
};

const RISK_DOT = {
  HEALTHY: "bg-cyan-400",
  WARNING: "bg-amber-400",
  CRITICAL: "bg-red-400",
};

const FILTER_OPTIONS = ["ALL", "HEALTHY", "WARNING", "CRITICAL"];

// ── Skeleton row for loading state ────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-white/5">
    {[...Array(8)].map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 rounded bg-white/5 animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
      </td>
    ))}
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function HistoryTable({ history, loading }) {
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let data = history || [];
    if (riskFilter !== "ALL") {
      data = data.filter((log) => log.riskLevel === riskFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (log) =>
          log.machineType?.toLowerCase().includes(q) ||
          log.riskLevel?.toLowerCase().includes(q)
      );
    }
    return data;
  }, [history, riskFilter, searchQuery]);

  return (
    <div className="glass-panel flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 pb-0">
        <p className="section-heading">
          <Database size={14} />
          Telemetry History
          {filtered.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs font-mono">
              {filtered.length}
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search type, risk…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300
                         placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-40 transition-colors"
            />
          </div>

          {/* Risk Filters */}
          <div className="flex items-center gap-1">
            <Filter size={12} className="text-slate-500" />
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setRiskFilter(opt)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200
                  ${
                    riskFilter === opt
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-500 hover:text-slate-300 border border-transparent"
                  }
                `}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/8">
              {["Time", "Type", "Air T (K)", "Process T (K)", "RPM", "Torque (Nm)", "Wear (min)", "Power (kW)", "Risk"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-slate-500 font-semibold tracking-wider uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-600">
                  {history?.length === 0
                    ? "No history yet — run your first analysis above"
                    : "No results match your filter"}
                </td>
              </tr>
            ) : (
              filtered.map((log, idx) => (
                <tr
                  key={log._id || idx}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors duration-150 animate-fade-in"
                >
                  <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-slate-700/60 font-bold text-slate-200">
                      {log.machineType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">{log.airTemp?.toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{log.processTemp?.toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{Math.round(log.rotationalSpeed)}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{log.torque?.toFixed(1)}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{Math.round(log.toolWear)}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{log.powerKw?.toFixed(3)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[log.riskLevel] || "bg-slate-500"}
                          ${log.riskLevel === "CRITICAL" ? "animate-pulse" : ""}`}
                      />
                      <span className={RISK_BADGE[log.riskLevel] || "badge-healthy"}>
                        {log.riskLevel}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
