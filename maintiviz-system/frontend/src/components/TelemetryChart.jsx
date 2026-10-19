/**
 * TelemetryChart — Historical trend visualizations
 * =================================================
 * Renders two Recharts area/line charts:
 *   1. Failure Probability timeline
 *   2. Multi-sensor overlay (Power kW + Temp Diff)
 *
 * Props:
 *   history  {Array}  Array of telemetry log objects from the backend
 */

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { TrendingUp, Activity } from "lucide-react";

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel p-3 text-xs shadow-xl border-slate-600/50">
      <p className="text-slate-400 mb-1 font-mono">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-300">{entry.name}:</span>
          <span className="font-bold" style={{ color: entry.color }}>
            {typeof entry.value === "number" ? entry.value.toFixed(3) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Chart area fill gradient definition ───────────────────────────────────────
const GradientDefs = () => (
  <defs>
    <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradAmber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
    </linearGradient>
    <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
    </linearGradient>
  </defs>
);

const AXIS_STYLE = { fill: "#64748b", fontSize: 11, fontFamily: "JetBrains Mono" };
const GRID_STYLE = { stroke: "rgba(255,255,255,0.04)" };

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TelemetryChart({ history }) {
  // Transform backend log objects for Recharts
  const chartData = useMemo(() => {
    if (!history?.length) return [];
    return [...history]
      .reverse()
      .slice(-30) // show last 30 readings
      .map((log, i) => ({
        idx: i + 1,
        time: new Date(log.timestamp).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        probability: parseFloat((log.failureProbability * 100).toFixed(2)),
        powerKw: parseFloat((log.powerKw || 0).toFixed(3)),
        tempDiff: parseFloat((log.tempDiff || 0).toFixed(2)),
        toolWear: log.toolWear,
      }));
  }, [history]);

  const isEmpty = chartData.length === 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* ── Chart 1: Failure Probability Timeline ─────────────────────────── */}
      <div className="glass-panel p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="section-heading">
            <Activity size={14} />
            Failure Probability Timeline
          </p>
          <span className="text-xs font-mono text-slate-500">Last 30 readings</span>
        </div>

        {isEmpty ? (
          <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
            No data — run an analysis first
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <GradientDefs />
              <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} vertical={false} />
              <XAxis dataKey="time" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Threshold reference lines */}
              <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6}
                label={{ value: "CRITICAL", fill: "#ef4444", fontSize: 10, position: "right" }}
              />
              <ReferenceLine y={24} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: "WARNING", fill: "#f59e0b", fontSize: 10, position: "right" }}
              />
              <Area
                type="monotone"
                dataKey="probability"
                name="Failure Prob %"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#gradCyan)"
                dot={false}
                activeDot={{ r: 5, fill: "#06b6d4", stroke: "#0f172a", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Chart 2: Power & Heat Dissipation Overlay ─────────────────────── */}
      <div className="glass-panel p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="section-heading">
            <TrendingUp size={14} />
            Power & Heat Dissipation
          </p>
          <span className="text-xs font-mono text-slate-500">Live sensors</span>
        </div>

        {isEmpty ? (
          <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
            No data — run an analysis first
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <GradientDefs />
              <CartesianGrid strokeDasharray="3 3" {...GRID_STYLE} vertical={false} />
              <XAxis dataKey="time" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "#64748b" }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="powerKw"
                name="Power (kW)"
                stroke="#818cf8"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#818cf8", stroke: "#0f172a", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="tempDiff"
                name="Temp Δ (K)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: "#f59e0b", stroke: "#0f172a", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
