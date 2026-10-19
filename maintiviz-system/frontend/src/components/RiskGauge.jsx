/**
 * RiskGauge — Animated SVG radial gauge displaying failure probability
 * =====================================================================
 * Renders a full-arc SVG gauge with:
 *  - Dynamic colour gradient (cyan → amber → crimson)
 *  - Animated needle sweep on value change
 *  - Central probability percentage with pulsing ring for CRITICAL state
 *
 * Props:
 *   probability  {number}  0–1  failure probability from ML model
 *   riskLevel    {string}  "HEALTHY" | "WARNING" | "CRITICAL"
 */

import React, { useEffect, useRef, useState } from "react";

const RISK_COLORS = {
  HEALTHY: { stroke: "#06b6d4", text: "#06b6d4", glow: "rgba(6,182,212,0.4)", badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" },
  WARNING: { stroke: "#f59e0b", text: "#f59e0b", glow: "rgba(245,158,11,0.4)", badge: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
  CRITICAL: { stroke: "#ef4444", text: "#ef4444", glow: "rgba(239,68,68,0.5)", badge: "bg-red-500/20 text-red-400 border-red-500/40" },
};

const RADIUS = 80;
const STROKE_WIDTH = 10;
const CX = 110;
const CY = 110;
const FULL_CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function RiskGauge({ probability = 0, riskLevel = "HEALTHY" }) {
  const [displayedProb, setDisplayedProb] = useState(0);
  const animRef = useRef(null);
  const prevProbRef = useRef(0);

  const colors = RISK_COLORS[riskLevel] || RISK_COLORS.HEALTHY;

  // Animate the probability number from previous to current value
  useEffect(() => {
    const start = prevProbRef.current;
    const end = probability;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (end - start) * eased;
      setDisplayedProb(current);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevProbRef.current = end;
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [probability]);

  // Arc fill: 0% = empty, 100% = full circle
  const progress = Math.min(Math.max(displayedProb, 0), 1);
  const strokeDashoffset = FULL_CIRCUMFERENCE * (1 - progress);
  const pct = Math.round(displayedProb * 100);

  const isCritical = riskLevel === "CRITICAL";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG Gauge */}
      <div className="relative" style={{ width: 220, height: 220 }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          {/* Glow filter */}
          <defs>
            <filter id="gauge-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track */}
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={STROKE_WIDTH}
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const x1 = CX + (RADIUS - 14) * Math.cos(rad);
            const y1 = CY + (RADIUS - 14) * Math.sin(rad);
            const x2 = CX + (RADIUS - 6) * Math.cos(rad);
            const y2 = CY + (RADIUS - 6) * Math.sin(rad);
            return (
              <line
                key={tick}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}

          {/* Progress arc */}
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={FULL_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CX} ${CY})`}
            filter="url(#gauge-glow)"
            style={{ transition: "stroke 0.5s ease, stroke-dashoffset 0.05s linear" }}
          />

          {/* Inner ring */}
          <circle
            cx={CX} cy={CY} r={RADIUS - 18}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />

          {/* Probability Text */}
          <text
            x={CX} y={CY - 8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="34"
            fontWeight="700"
            fontFamily="'Inter', sans-serif"
            fill={colors.text}
          >
            {pct}%
          </text>
          <text
            x={CX} y={CY + 20}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fontWeight="500"
            fontFamily="'Inter', sans-serif"
            fill="rgba(255,255,255,0.5)"
            letterSpacing="2"
          >
            FAILURE RISK
          </text>
        </svg>

        {/* Pulsing ring for CRITICAL */}
        {isCritical && (
          <span
            className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping"
            style={{ animationDuration: "1.5s" }}
          />
        )}
      </div>

      {/* Risk Badge */}
      <span
        className={`px-5 py-1.5 rounded-full text-sm font-bold tracking-widest border ${colors.badge} transition-all duration-500`}
      >
        {isCritical && "🔴 "}{riskLevel === "WARNING" && "🟡 "}{riskLevel === "HEALTHY" && "🟢 "}
        {riskLevel}
      </span>
    </div>
  );
}
