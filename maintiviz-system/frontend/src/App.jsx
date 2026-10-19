/**
 * MaintiViz Edge Engine — Dashboard App
 * =======================================
 * Main layout orchestrating all dashboard panels:
 *   - Navbar with live connection status indicators
 *   - KPI metrics header strip
 *   - Left column: Telemetry sliders + Analyze button
 *   - Center/Right: Risk gauge + analysis results + live physics metrics
 *   - Historical charts (Recharts)
 *   - Filterable history table
 *   - API Inspector slide-in drawer
 *
 * State management is colocated here and props-drilled to children.
 * For a production app, consider Zustand or React Context for global state.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Code2,
  Cpu,
  Database,
  Gauge,
  RefreshCw,
  Send,
  Shield,
  Zap,
} from "lucide-react";

import { analyzeTelemetry, fetchHistory, fetchStats } from "./api.js";
import RiskGauge from "./components/RiskGauge.jsx";
import TelemetrySliders from "./components/TelemetrySliders.jsx";
import TelemetryChart from "./components/TelemetryChart.jsx";
import HistoryTable from "./components/HistoryTable.jsx";
import MetricsCards from "./components/MetricsCards.jsx";
import ApiInspector from "./components/ApiInspector.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT TELEMETRY STATE (Normal operational baseline)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_TELEMETRY = {
  machineType: "M",
  airTemp: 298.1,
  processTemp: 308.6,
  rotationalSpeed: 1551,
  torque: 42.8,
  toolWear: 108,
};

// ─────────────────────────────────────────────────────────────────────────────
// NAVBAR COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function Navbar({ onOpenInspector, mlStatus, dbStatus }) {
  const StatusDot = ({ ok, label }) => (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-cyan-400 animate-pulse" : "bg-red-500"}`} />
      <span className="text-xs text-slate-400 font-mono hidden sm:block">{label}</span>
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-white/6 backdrop-blur-xl"
      style={{ background: "rgba(10, 14, 26, 0.9)" }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Gauge size={18} className="text-white" />
          </div>
          <div className="leading-none">
            <h1 className="text-sm font-black tracking-tight text-white">
              Mainti<span className="text-gradient-cyan">Viz</span>
            </h1>
            <p className="text-xs text-slate-500 tracking-widest font-mono">EDGE ENGINE</p>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 sm:gap-6">
          <StatusDot ok={mlStatus} label="ML :8000" />
          <StatusDot ok={dbStatus} label="DB Atlas" />
          <div className="h-4 w-px bg-white/10" />
          <button
            id="api-inspector-btn"
            onClick={onOpenInspector}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10
                       bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs
                       font-semibold tracking-wide transition-all duration-200"
          >
            <Code2 size={13} />
            <span className="hidden sm:block">API Inspector</span>
          </button>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS RESULT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AnalysisResult({ analysis, error, loading }) {
  const risk = analysis?.risk_level;
  const borderColor =
    risk === "CRITICAL" ? "border-red-500/30 glow-red" :
    risk === "WARNING"  ? "border-amber-500/30 glow-amber" :
    risk               ? "border-cyan-500/30 glow-cyan" :
                         "border-white/6";

  return (
    <div className={`glass-panel p-6 flex flex-col items-center gap-6 border ${borderColor} transition-all duration-700`}>
      {/* Gauge */}
      <RiskGauge
        probability={analysis?.failure_probability ?? 0}
        riskLevel={analysis?.risk_level ?? "HEALTHY"}
      />

      {/* Physics metrics */}
      {analysis && (
        <div className="w-full grid grid-cols-2 gap-3">
          {[
            { label: "Power Output", value: `${analysis.powerKw?.toFixed(3) ?? "—"} kW`, icon: Zap, color: "#818cf8" },
            { label: "Heat ΔT", value: `${analysis.tempDiff?.toFixed(2) ?? "—"} K`, icon: Activity, color: "#f59e0b" },
            { label: "Threshold", value: `${((analysis.threshold_used ?? 0.4) * 100).toFixed(0)}%`, icon: Shield, color: "#06b6d4" },
            { label: "Model", value: analysis.model_version ?? "v1.0", icon: Cpu, color: "#a78bfa" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl p-3 flex items-center gap-3 transition-all duration-300"
              style={{ background: `${color}08`, border: `1px solid ${color}18` }}
            >
              <Icon size={14} style={{ color, flexShrink: 0 }} />
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{label}</p>
                <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Awaiting state */}
      {!analysis && !error && !loading && (
        <p className="text-sm text-slate-600 text-center">
          Adjust sensors and click<br />
          <strong className="text-slate-400">"Run Analysis"</strong> to get predictions
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Telemetry input state ─────────────────────────────────────────────────
  const [telemetry, setTelemetry] = useState(DEFAULT_TELEMETRY);

  // ── API response state ────────────────────────────────────────────────────
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Historical data state ─────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // ── API Inspector state ────────────────────────────────────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastError, setLastError] = useState(null);

  // ── Service status ─────────────────────────────────────────────────────────
  const [mlStatus, setMlStatus] = useState(false);
  const [dbStatus, setDbStatus] = useState(false);

  // ── Auto-refresh interval ref ──────────────────────────────────────────────
  const refreshRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // LOAD HISTORY & STATS
  // ─────────────────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [histData, statsData] = await Promise.all([
        fetchHistory(),
        fetchStats(),
      ]);
      setHistory(histData.logs || []);
      setStats(statsData.stats || null);
      setDbStatus(true);
    } catch {
      setDbStatus(false);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadHistory();
    // Probe ML service health
    fetch("http://localhost:8000/health")
      .then((r) => { if (r.ok) setMlStatus(true); })
      .catch(() => setMlStatus(false));
  }, [loadHistory]);

  // ─────────────────────────────────────────────────────────────────────────
  // TELEMETRY CHANGE HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleSliderChange = useCallback((field, value) => {
    setTelemetry((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handlePreset = useCallback((presetValues) => {
    setTelemetry(presetValues);
    setAnalysis(null);
    setError(null);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ANALYZE HANDLER
  // ─────────────────────────────────────────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLastError(null);
    setLastRequest(telemetry);

    try {
      const result = await analyzeTelemetry(telemetry);
      setAnalysis(result.analysis);
      setLastResponse(result);
      setLastError(null);
      setMlStatus(true);
      setDbStatus(true);
      // Refresh history after a short delay so the new log appears
      setTimeout(() => loadHistory(), 500);
    } catch (err) {
      const msg = err.message || "Analysis failed. Check that all services are running.";
      setError(msg);
      setLastError(msg);
      setLastResponse(null);
    } finally {
      setLoading(false);
    }
  }, [telemetry, loadHistory]);

  // ─────────────────────────────────────────────────────────────────────────
  // KEYBOARD SHORTCUT: Enter key to run analysis
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !loading) {
        handleAnalyze();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleAnalyze, loading]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen grid-pattern">
      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <Navbar
        onOpenInspector={() => setInspectorOpen(true)}
        mlStatus={mlStatus}
        dbStatus={dbStatus}
      />

      {/* ── Main Layout ─────────────────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Hero Section ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 animate-fade-in">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-white">
              Industrial Telemetry{" "}
              <span className="text-gradient-cyan">Command Center</span>
            </h2>
            <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400 font-semibold">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              LIVE
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Real-time ML-powered predictive maintenance • AI4I Dataset • RandomForest + Physics Features
          </p>
        </div>

        {/* ── KPI Metrics Strip ─────────────────────────────────────────── */}
        <MetricsCards stats={stats} analysis={analysis} loading={loading} />

        {/* ── Main 3-Column Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start">

          {/* Column 1 — Sensor Controls */}
          <div className="lg:col-span-1 space-y-4 animate-slide-up">
            <TelemetrySliders
              values={telemetry}
              onChange={handleSliderChange}
              onPreset={handlePreset}
              loading={loading}
            />

            {/* Analyze Button */}
            <button
              id="analyze-btn"
              onClick={handleAnalyze}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Send size={16} />
                  Run Analysis
                  <span className="hidden sm:block text-xs opacity-60 font-normal">⌘+Enter</span>
                </>
              )}
            </button>
          </div>

          {/* Column 2 — Risk Gauge & Analysis */}
          <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <AnalysisResult
              analysis={analysis}
              error={error}
              loading={loading}
            />
          </div>

          {/* Column 3 & 4 — Feature Details + System Status */}
          <div className="lg:col-span-1 xl:col-span-2 flex flex-col gap-4 animate-slide-up" style={{ animationDelay: "0.15s" }}>

            {/* Current Telemetry Readout */}
            <div className="glass-panel p-5">
              <p className="section-heading mb-4">
                <Database size={14} />
                Current Sensor Readout
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Machine Type", value: telemetry.machineType, unit: "", color: "#818cf8" },
                  { label: "Air Temp", value: telemetry.airTemp?.toFixed(1), unit: "K", color: "#06b6d4" },
                  { label: "Process Temp", value: telemetry.processTemp?.toFixed(1), unit: "K", color: "#f59e0b" },
                  { label: "RPM", value: Math.round(telemetry.rotationalSpeed), unit: "rpm", color: "#a78bfa" },
                  { label: "Torque", value: telemetry.torque?.toFixed(1), unit: "Nm", color: "#f59e0b" },
                  { label: "Tool Wear", value: Math.round(telemetry.toolWear), unit: "min", color: telemetry.toolWear > 200 ? "#ef4444" : "#06b6d4" },
                ].map(({ label, value, unit, color }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 transition-all duration-300"
                    style={{ background: `${color}08`, border: `1px solid ${color}18` }}
                  >
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <p className="text-xl font-bold font-mono" style={{ color }}>
                      {value}
                      <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Engineered Features (shown post-analysis) */}
            {analysis && (
              <div className="glass-panel p-5 animate-fade-in">
                <p className="section-heading mb-4">
                  <Zap size={14} />
                  Physics-Engineered Features
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4 bg-purple-500/8 border border-purple-500/18">
                    <p className="text-xs text-slate-500">Power (kW)</p>
                    <p className="text-2xl font-black font-mono text-purple-400">
                      {analysis.powerKw?.toFixed(4)}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">RPM × Torque × 2π / 60,000</p>
                  </div>
                  <div className="rounded-xl p-4 bg-amber-500/8 border border-amber-500/18">
                    <p className="text-xs text-slate-500">Temp Diff (K)</p>
                    <p className="text-2xl font-black font-mono text-amber-400">
                      {analysis.tempDiff?.toFixed(3)}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">Process T − Air T</p>
                  </div>
                </div>
              </div>
            )}

            {/* System Health Panel */}
            <div className="glass-panel p-5">
              <p className="section-heading mb-4">
                <Shield size={14} />
                System Health
              </p>
              <div className="space-y-3">
                {[
                  { label: "ML Microservice (FastAPI :8000)", status: mlStatus },
                  { label: "API Gateway (Express :5000)", status: true },
                  { label: "MongoDB Atlas", status: dbStatus },
                ].map(({ label, status }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${status ? "bg-cyan-400 animate-pulse" : "bg-red-500"}`} />
                      <span className={`text-xs font-semibold ${status ? "text-cyan-400" : "text-red-400"}`}>
                        {status ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Historical Charts ────────────────────────────────────────── */}
        <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <div className="flex items-center justify-between mb-4">
            <p className="section-heading">
              <Activity size={14} />
              Historical Trend Analysis
            </p>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white
                         border border-white/10 hover:border-white/20 transition-all"
            >
              <RefreshCw size={11} className={historyLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
          <TelemetryChart history={history} />
        </div>

        {/* ── History Table ─────────────────────────────────────────────── */}
        <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
          <HistoryTable history={history} loading={historyLoading} />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="text-center py-6 border-t border-white/5">
          <p className="text-xs text-slate-600 font-mono">
            MaintiViz Edge Engine v1.0.0 • Built with MERN + FastAPI + XGBoost •{" "}
            <span className="text-slate-500">AI4I Predictive Maintenance Dataset</span>
          </p>
        </footer>
      </main>

      {/* ── API Inspector Drawer ─────────────────────────────────────── */}
      <ApiInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        requestPayload={lastRequest}
        responsePayload={lastResponse}
        loading={loading}
        error={lastError}
      />
    </div>
  );
}
