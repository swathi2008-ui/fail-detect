/**
 * MaintiViz Edge Engine — Axios API Service
 * ==========================================
 * Centralised HTTP client for all backend API communication.
 * Handles base URL configuration, timeouts, and request/response interceptors.
 */

import axios from "axios";

// Base URL sourced from Vite env or fallback to localhost
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 12000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request Interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    // Could attach auth tokens here in a production app
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      "Unknown network error";
    console.error("[API Error]", message);
    return Promise.reject(new Error(message));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a telemetry payload for ML analysis.
 *
 * @param {Object} telemetry - { machineType, airTemp, processTemp, rotationalSpeed, torque, toolWear }
 * @returns {Promise<Object>} Full analysis result from the ML service
 */
export const analyzeTelemetry = async (telemetry) => {
  const { data } = await api.post("/telemetry/analyze", telemetry);
  return data;
};

/**
 * Retrieves the last 50 historical telemetry logs.
 *
 * @returns {Promise<Array>} Array of log objects
 */
export const fetchHistory = async () => {
  const { data } = await api.get("/telemetry/history");
  return data;
};

/**
 * Retrieves aggregated dashboard KPIs.
 *
 * @returns {Promise<Object>} Stats object { totalInspections, failureRate, criticalAlerts, ... }
 */
export const fetchStats = async () => {
  const { data } = await api.get("/telemetry/stats");
  return data;
};

export default api;
