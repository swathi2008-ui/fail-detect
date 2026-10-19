/**
 * MetricsCards — Dashboard KPI header strip
 * ==========================================
 * Renders animated stat cards for key predictive maintenance metrics.
 *
 * Props:
 *   stats      {Object}   { totalInspections, failureRate, criticalAlerts, ... }
 *   analysis   {Object}   Latest prediction result
 *   loading    {boolean}
 */

import React from "react";
import { Activity, AlertTriangle, Database, ShieldCheck, TrendingUp, Zap } from "lucide-react";

const StatCard = ({ icon: Icon, label, value, subValue, color, glowClass, loading }) => (
  <div className={`metric-card ${glowClass || ""}`}>
    <div className="flex items-center justify-between mb-2">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: `${color}15` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      {loading && (
        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${color}40`, borderTopColor: color }} />
      )}
    </div>
    <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">{label}</p>
    <p
      className="text-2xl font-bold font-mono tabular-nums mt-0.5 transition-all duration-500"
      style={{ color: loading ? "rgba(255,255,255,0.3)" : color }}
    >
      {loading ? "—" : value}
    </p>
    {subValue && (
      <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>
    )}
  </div>
);

export default function MetricsCards({ stats, analysis, loading }) {
  const powerKw = analysis?.powerKw?.toFixed(2) ?? "—";
  const tempDiff = analysis?.tempDiff?.toFixed(1) ?? "—";
  const prob = analysis?.failure_probability != null
    ? `${(analysis.failure_probability * 100).toFixed(1)}%`
    : "—";

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <StatCard
        icon={Database}
        label="Total Inspections"
        value={stats?.totalInspections ?? 0}
        color="#818cf8"
        loading={false}
      />
      <StatCard
        icon={TrendingUp}
        label="Failure Rate"
        value={stats?.failureRate ?? "0%"}
        color="#f59e0b"
        loading={false}
      />
      <StatCard
        icon={AlertTriangle}
        label="Critical Alerts"
        value={stats?.criticalAlerts ?? 0}
        color="#ef4444"
        glowClass={stats?.criticalAlerts > 0 ? "border-red-500/20" : ""}
        loading={false}
      />
      <StatCard
        icon={Activity}
        label="Failure Prob."
        value={prob}
        color={
          analysis?.risk_level === "CRITICAL"
            ? "#ef4444"
            : analysis?.risk_level === "WARNING"
            ? "#f59e0b"
            : "#06b6d4"
        }
        loading={loading}
      />
      <StatCard
        icon={Zap}
        label="Power Output"
        value={`${powerKw} kW`}
        color="#818cf8"
        subValue="Mechanical power"
        loading={loading}
      />
      <StatCard
        icon={ShieldCheck}
        label="Heat ΔT"
        value={`${tempDiff} K`}
        color={parseFloat(tempDiff) > 12 ? "#ef4444" : "#06b6d4"}
        subValue="Temp differential"
        loading={loading}
      />
    </div>
  );
}
