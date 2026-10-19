/**
 * MaintiViz Edge Engine — Telemetry Log Schema
 * ==============================================
 * Mongoose schema for storing telemetry readings, ML predictions,
 * and anomaly flags in MongoDB Atlas.
 */

const mongoose = require("mongoose");

/**
 * @typedef {Object} TelemetryLog
 * @property {string}  machineType         - Quality grade of machine (L/M/H)
 * @property {number}  airTemp             - Ambient temperature in Kelvin
 * @property {number}  processTemp         - Process temperature in Kelvin
 * @property {number}  rotationalSpeed     - Spindle speed in RPM
 * @property {number}  torque              - Shaft torque in Nm
 * @property {number}  toolWear            - Cumulative tool wear in minutes
 * @property {number}  powerKw             - Calculated mechanical power in kW
 * @property {number}  tempDiff            - Process – Air temperature delta
 * @property {boolean} failurePredicted    - Whether model triggered failure alert
 * @property {number}  failureProbability  - Raw model output [0, 1]
 * @property {string}  riskLevel           - HEALTHY | WARNING | CRITICAL
 * @property {Date}    timestamp           - When the analysis was performed
 */
const LogSchema = new mongoose.Schema(
  {
    // ── Raw Sensor Inputs ──────────────────────────────────────────────────
    machineType: {
      type: String,
      enum: ["L", "M", "H"],
      required: true,
      index: true,
    },
    airTemp: {
      type: Number,
      required: true,
      min: 250,
      max: 400,
    },
    processTemp: {
      type: Number,
      required: true,
      min: 250,
      max: 400,
    },
    rotationalSpeed: {
      type: Number,
      required: true,
      min: 100,
      max: 5000,
    },
    torque: {
      type: Number,
      required: true,
      min: 0,
      max: 250,
    },
    toolWear: {
      type: Number,
      required: true,
      min: 0,
      max: 300,
    },

    // ── Engineered Physics Features ────────────────────────────────────────
    powerKw: {
      type: Number,
      required: true,
    },
    tempDiff: {
      type: Number,
      required: true,
    },

    // ── ML Prediction Output ───────────────────────────────────────────────
    failurePredicted: {
      type: Boolean,
      required: true,
      index: true,
    },
    failureProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    riskLevel: {
      type: String,
      enum: ["HEALTHY", "WARNING", "CRITICAL"],
      required: true,
      index: true,
    },

    // ── Metadata ───────────────────────────────────────────────────────────
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // using manual timestamp field for precise control
    versionKey: false,
  }
);

// Compound index for dashboard queries (recent failures by type)
LogSchema.index({ riskLevel: 1, timestamp: -1 });
LogSchema.index({ machineType: 1, timestamp: -1 });

module.exports = mongoose.model("TelemetryLog", LogSchema);
