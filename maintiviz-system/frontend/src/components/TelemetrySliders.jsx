/**
 * TelemetrySliders — Interactive sensor control panel
 * =====================================================
 * Renders labelled range sliders for each telemetry dimension.
 * Supports preset scenario quick-load buttons.
 *
 * Props:
 *   values      {Object}   Current telemetry values
 *   onChange    {Function} Called with (field, value) on slider change
 *   onPreset    {Function} Called with preset object to bulk-set values
 *   loading     {boolean}  Disables controls while prediction is in flight
 */

import React from "react";
import { Sliders, Zap, Thermometer, Gauge, Wrench, Cpu } from "lucide-react";

// ── Slider Configuration ───────────────────────────────────────────────────────
const SLIDER_CONFIG = [
  {
    key: "airTemp",
    label: "Air Temperature",
    unit: "K",
    min: 295,
    max: 304,
    step: 0.1,
    icon: Thermometer,
    color: "#06b6d4",
    description: "Ambient air temperature",
  },
  {
    key: "processTemp",
    label: "Process Temperature",
    unit: "K",
    min: 305,
    max: 316,
    step: 0.1,
    icon: Thermometer,
    color: "#f59e0b",
    description: "Active process temperature",
  },
  {
    key: "rotationalSpeed",
    label: "Rotational Speed",
    unit: "RPM",
    min: 1168,
    max: 2886,
    step: 1,
    icon: Gauge,
    color: "#818cf8",
    description: "Spindle rotational speed",
  },
  {
    key: "torque",
    label: "Torque",
    unit: "Nm",
    min: 3.8,
    max: 76.6,
    step: 0.1,
    icon: Zap,
    color: "#f59e0b",
    description: "Shaft torque",
  },
  {
    key: "toolWear",
    label: "Tool Wear",
    unit: "min",
    min: 0,
    max: 253,
    step: 1,
    icon: Wrench,
    color: "#f87171",
    description: "Cumulative tool wear",
  },
];

// ── Preset Scenarios ───────────────────────────────────────────────────────────
export const PRESETS = [
  {
    id: "normal",
    label: "Normal Operations",
    emoji: "🟢",
    color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20",
    values: {
      machineType: "M",
      airTemp: 298.1,
      processTemp: 308.6,
      rotationalSpeed: 1551,
      torque: 42.8,
      toolWear: 108,
    },
  },
  {
    id: "high_torque",
    label: "High Torque Strain",
    emoji: "🟡",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
    values: {
      machineType: "L",
      airTemp: 299.3,
      processTemp: 309.7,
      rotationalSpeed: 1408,
      torque: 68.5,
      toolWear: 195,
    },
  },
  {
    id: "thermal_overheat",
    label: "Thermal Overheat",
    emoji: "🔴",
    color: "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
    values: {
      machineType: "L",
      airTemp: 303.8,
      processTemp: 315.5,
      rotationalSpeed: 1265,
      torque: 69.2,
      toolWear: 201,
    },
  },
  {
    id: "tool_breakdown",
    label: "Tool Wear Breakdown",
    emoji: "🔴",
    color: "text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20",
    values: {
      machineType: "H",
      airTemp: 301.2,
      processTemp: 311.8,
      rotationalSpeed: 1380,
      torque: 72.1,
      toolWear: 248,
    },
  },
];

// ── Helper — compute fill percentage for slider track ─────────────────────────
const getFillPct = (value, min, max) =>
  (((value - min) / (max - min)) * 100).toFixed(1) + "%";

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function TelemetrySliders({ values, onChange, onPreset, loading }) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Preset Buttons ─────────────────────────────────────────────────── */}
      <div>
        <p className="section-heading mb-3">
          <Cpu size={14} />
          Quick Scenarios
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              disabled={loading}
              onClick={() => onPreset(preset.values)}
              className={`btn-preset ${preset.color} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span className="mr-1">{preset.emoji}</span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Machine Type Selector ──────────────────────────────────────────── */}
      <div className="glass-panel p-4 flex flex-col gap-3">
        <p className="section-heading">
          <Sliders size={14} />
          Machine Type
        </p>
        <div className="flex gap-2">
          {["L", "M", "H"].map((t) => (
            <button
              key={t}
              disabled={loading}
              onClick={() => onChange("machineType", t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold tracking-widest transition-all duration-200 border
                ${
                  values.machineType === t
                    ? "bg-cyan-500/25 border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                }
              `}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {values.machineType === "L" && "Low quality — 60% of fleet"}
          {values.machineType === "M" && "Medium quality — 30% of fleet"}
          {values.machineType === "H" && "High quality — 10% of fleet"}
        </p>
      </div>

      {/* ── Sensor Sliders ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {SLIDER_CONFIG.map(({ key, label, unit, min, max, step, icon: Icon, color, description }) => {
          const val = values[key] ?? min;
          const fillPct = getFillPct(val, min, max);
          const wearPct = key === "toolWear" ? (val / max) * 100 : null;

          return (
            <div key={key} className="glass-panel p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}18` }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500">{description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="text-lg font-bold font-mono tabular-nums"
                    style={{ color }}
                  >
                    {typeof val === "number" && val % 1 !== 0
                      ? val.toFixed(1)
                      : Math.round(val)}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">{unit}</span>
                </div>
              </div>

              {/* Slider with gradient track */}
              <div className="relative">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={val}
                  disabled={loading}
                  onChange={(e) => onChange(key, parseFloat(e.target.value))}
                  className="slider-track"
                  style={{
                    background: `linear-gradient(to right, ${color} 0%, ${color} ${fillPct}, rgba(255,255,255,0.08) ${fillPct})`,
                  }}
                />
              </div>

              {/* Min/Max labels + optional tool wear warning */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-600 font-mono">{min} {unit}</span>
                {wearPct !== null && wearPct > 80 && (
                  <span className="text-xs text-red-400 font-semibold animate-pulse">
                    ⚠ Near End-of-Life
                  </span>
                )}
                <span className="text-xs text-slate-600 font-mono">{max} {unit}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
