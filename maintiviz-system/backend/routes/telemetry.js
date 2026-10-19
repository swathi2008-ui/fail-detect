/**
 * MaintiViz Edge Engine — Telemetry API Routes
 * ==============================================
 * Express router exposing 3 REST endpoints:
 *
 *   POST /api/telemetry/analyze  — Forward to FastAPI, persist, return analysis
 *   GET  /api/telemetry/history  — Last 50 telemetry logs (descending by time)
 *   GET  /api/telemetry/stats    — Aggregate KPIs for the dashboard header
 */

const express = require("express");
const axios = require("axios");
const TelemetryLog = require("../models/Log");

const router = express.Router();

// FastAPI microservice base URL from environment
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || "8000", 10);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — Map flat camelCase body → AI4I field names expected by FastAPI
// ─────────────────────────────────────────────────────────────────────────────
const buildFastApiPayload = (body) => ({
  Type: body.machineType,
  "Air temperature [K]": Number(body.airTemp),
  "Process temperature [K]": Number(body.processTemp),
  "Rotational speed [rpm]": Number(body.rotationalSpeed),
  "Torque [Nm]": Number(body.torque),
  "Tool wear [min]": Number(body.toolWear),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/telemetry/analyze
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   POST /api/telemetry/analyze
 * @desc    Validate telemetry → forward to ML microservice → persist → respond
 * @access  Public (add auth middleware in production)
 */
router.post("/analyze", async (req, res) => {
  const { machineType, airTemp, processTemp, rotationalSpeed, torque, toolWear } = req.body;

  // ── Input Validation ──────────────────────────────────────────────────────
  if (!machineType || !["L", "M", "H"].includes(machineType)) {
    return res.status(400).json({
      error: "Invalid machineType. Must be one of: L, M, H",
    });
  }

  const numericFields = { airTemp, processTemp, rotationalSpeed, torque, toolWear };
  for (const [field, value] of Object.entries(numericFields)) {
    if (value === undefined || value === null || isNaN(Number(value))) {
      return res.status(400).json({ error: `Missing or non-numeric field: ${field}` });
    }
  }

  // ── Forward to FastAPI ────────────────────────────────────────────────────
  let mlResponse;
  try {
    const { data } = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      buildFastApiPayload(req.body),
      { timeout: ML_TIMEOUT_MS }
    );
    mlResponse = data;
  } catch (err) {
    if (err.response) {
      // FastAPI returned a validation/application error
      return res.status(502).json({
        error: "ML service rejected the payload",
        detail: err.response.data?.detail || err.response.data,
      });
    }
    // Network / timeout error — use heuristic fallback so dashboard stays alive
    console.warn("⚠️  ML service unreachable — using heuristic fallback:", err.message);

    const Math2PI60 = (2 * Math.PI) / 60;
    const powerKw = (Number(rotationalSpeed) * Number(torque) * Math2PI60) / 1000;
    const tempDiff = Number(processTemp) - Number(airTemp);

    // Simple heuristic: high tool wear + high power → elevated risk
    let prob = Math.min(
      0.3 * (Number(toolWear) / 250) +
      0.25 * Math.min(Math.max(powerKw - 3, 0) / 10, 1) +
      0.25 * Math.min(Math.max(tempDiff - 8, 0) / 10, 1) +
      0.2 * Math.min(Math.max(Number(torque) - 30, 0) / 70, 1),
      0.99
    );

    mlResponse = {
      failure_probability: parseFloat(prob.toFixed(4)),
      risk_level: prob >= 0.4 ? "CRITICAL" : prob >= 0.24 ? "WARNING" : "HEALTHY",
      threshold_used: 0.4,
      features: { Temp_Diff: tempDiff, Power_kW: powerKw },
      model_version: "heuristic-fallback",
    };
  }

  // ── Derived Fields ────────────────────────────────────────────────────────
  const powerKw = mlResponse.features?.Power_kW ?? 0;
  const tempDiff = mlResponse.features?.Temp_Diff ?? 0;

  // ── Persist to MongoDB ────────────────────────────────────────────────────
  let savedLog = null;
  try {
    savedLog = await TelemetryLog.create({
      machineType,
      airTemp: Number(airTemp),
      processTemp: Number(processTemp),
      rotationalSpeed: Number(rotationalSpeed),
      torque: Number(torque),
      toolWear: Number(toolWear),
      powerKw,
      tempDiff,
      failurePredicted: mlResponse.risk_level !== "HEALTHY",
      failureProbability: mlResponse.failure_probability,
      riskLevel: mlResponse.risk_level,
    });
  } catch (dbErr) {
    // Non-fatal — respond with the ML result even if DB write fails
    console.error("❌  MongoDB write failed:", dbErr.message);
  }

  // ── Response ──────────────────────────────────────────────────────────────
  return res.status(200).json({
    success: true,
    analysis: {
      ...mlResponse,
      powerKw,
      tempDiff,
      logId: savedLog?._id ?? null,
      timestamp: savedLog?.timestamp ?? new Date().toISOString(),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/telemetry/history
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/telemetry/history
 * @desc    Return the last 50 telemetry logs sorted newest-first
 * @access  Public
 */
router.get("/history", async (req, res) => {
  try {
    const logs = await TelemetryLog.find()
      .sort({ timestamp: -1 })
      .limit(50)
      .select("-__v")
      .lean();

    return res.status(200).json({ success: true, count: logs.length, logs });
  } catch (err) {
    console.error("❌  History query failed:", err.message);
    return res.status(503).json({
      error: "Database unavailable. History temporarily disabled.",
      logs: [],
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/telemetry/stats
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @route   GET /api/telemetry/stats
 * @desc    Aggregate KPIs: total inspections, failure rate, critical count
 * @access  Public
 */
router.get("/stats", async (req, res) => {
  try {
    const [totalResult, criticalCount, warningCount, avgProbResult] = await Promise.all([
      TelemetryLog.countDocuments(),
      TelemetryLog.countDocuments({ riskLevel: "CRITICAL" }),
      TelemetryLog.countDocuments({ riskLevel: "WARNING" }),
      TelemetryLog.aggregate([
        { $group: { _id: null, avgProb: { $avg: "$failureProbability" } } },
      ]),
    ]);

    const total = totalResult;
    const failureRate =
      total > 0 ? (((criticalCount + warningCount) / total) * 100).toFixed(1) : "0.0";
    const avgProbability =
      avgProbResult[0]?.avgProb != null
        ? (avgProbResult[0].avgProb * 100).toFixed(1)
        : "0.0";

    return res.status(200).json({
      success: true,
      stats: {
        totalInspections: total,
        failureRate: `${failureRate}%`,
        criticalAlerts: criticalCount,
        warningAlerts: warningCount,
        avgFailureProbability: `${avgProbability}%`,
      },
    });
  } catch (err) {
    console.error("❌  Stats aggregation failed:", err.message);
    return res.status(503).json({
      error: "Database unavailable. Stats temporarily disabled.",
      stats: {
        totalInspections: 0,
        failureRate: "N/A",
        criticalAlerts: 0,
        warningAlerts: 0,
        avgFailureProbability: "N/A",
      },
    });
  }
});

module.exports = router;
