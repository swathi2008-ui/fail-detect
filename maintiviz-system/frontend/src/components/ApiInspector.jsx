/**
 * ApiInspector — Live request/response payload drawer
 * =====================================================
 * Side drawer that shows the exact JSON payloads exchanged between:
 *   React → Express → FastAPI
 *
 * Useful for demos, debugging, and understanding the data flow.
 *
 * Props:
 *   isOpen        {boolean}
 *   onClose       {Function}
 *   requestPayload  {Object}  The payload sent to /api/telemetry/analyze
 *   responsePayload {Object}  The full response received from the backend
 *   loading         {boolean}
 */

import React, { useState } from "react";
import { X, Code2, ArrowRight, Clock, CheckCircle2, XCircle, Copy, Check } from "lucide-react";

// ── Pretty JSON block ─────────────────────────────────────────────────────────
const JsonBlock = ({ data, title, badge, badgeColor }) => {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
          {badge && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}
            >
              {badge}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs transition-all"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre
        className="rounded-xl p-4 text-xs font-mono overflow-x-auto leading-relaxed"
        style={{
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#e2e8f0",
          maxHeight: "280px",
        }}
      >
        <code>{json}</code>
      </pre>
    </div>
  );
};

// ── Flow diagram ──────────────────────────────────────────────────────────────
const FlowStep = ({ label, sub, active, done, error }) => (
  <div className={`flex flex-col items-center gap-1 transition-all duration-500 ${active ? "scale-105" : ""}`}>
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border transition-all duration-500
        ${error ? "bg-red-500/20 border-red-500/50 text-red-400" :
          done ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" :
          active ? "bg-slate-700 border-slate-500 text-white animate-pulse" :
          "bg-slate-800 border-slate-700 text-slate-600"}
      `}
    >
      {error ? <XCircle size={16} /> : done ? <CheckCircle2 size={16} /> : label[0]}
    </div>
    <span className="text-xs text-slate-500 text-center leading-tight">{label}</span>
    {sub && <span className="text-xs text-slate-600 font-mono">{sub}</span>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ApiInspector({ isOpen, onClose, requestPayload, responsePayload, loading, error }) {
  const hasResponse = !!responsePayload;
  const hasError = !!error;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 h-full z-50 flex flex-col
          transition-transform duration-400 ease-out
          w-full max-w-xl
          ${isOpen ? "translate-x-0" : "translate-x-full"}
        `}
        style={{
          background: "linear-gradient(160deg, #0a0e1a 0%, #0f1629 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* ── Drawer Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Code2 size={18} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">API Inspector</h2>
              <p className="text-xs text-slate-500">React → Express → FastAPI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* ── Request Flow Diagram ───────────────────────────────────────── */}
        <div className="p-5 border-b border-white/6">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">
            Request Pipeline
          </p>
          <div className="flex items-center gap-2 justify-center">
            <FlowStep label="React UI" sub=":5173" done={!!requestPayload} active={loading && !requestPayload} />
            <ArrowRight size={14} className={`text-slate-600 transition-colors ${loading ? "text-cyan-500 animate-pulse" : ""}`} />
            <FlowStep label="Express" sub=":5000" done={hasResponse || hasError} active={loading} error={hasError} />
            <ArrowRight size={14} className={`text-slate-600 transition-colors ${loading ? "text-cyan-500 animate-pulse" : ""}`} />
            <FlowStep label="FastAPI" sub=":8000" done={hasResponse && !hasError} active={loading} error={hasError} />
          </div>

          {loading && (
            <div className="mt-4 flex items-center gap-2 justify-center">
              <Clock size={12} className="text-cyan-400 animate-spin" />
              <span className="text-xs text-cyan-400 font-mono animate-pulse">Awaiting ML inference…</span>
            </div>
          )}
          {hasError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
              ❌ {error}
            </div>
          )}
        </div>

        {/* ── Payload Views ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {requestPayload ? (
            <JsonBlock
              data={requestPayload}
              title="POST /api/telemetry/analyze"
              badge="REQUEST"
              badgeColor="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            />
          ) : (
            <div className="flex items-center justify-center h-24 text-slate-600 text-sm">
              Submit an analysis to inspect the request payload
            </div>
          )}

          {hasResponse && (
            <JsonBlock
              data={responsePayload}
              title="200 OK Response"
              badge="RESPONSE"
              badgeColor="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            />
          )}

          {loading && !hasResponse && (
            <div className="space-y-2">
              {[80, 95, 70, 88].map((w, i) => (
                <div key={i} className="h-4 rounded bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="p-4 border-t border-white/6 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${hasError ? "bg-red-400" : hasResponse ? "bg-cyan-400 animate-pulse" : "bg-slate-600"}`} />
          <span className="text-xs text-slate-500 font-mono">
            {hasError ? "Last request failed" : hasResponse ? "Last request succeeded" : "No requests yet"}
          </span>
        </div>
      </div>
    </>
  );
}
