/**
 * MaintiViz Edge Engine — Express API Gateway
 * =============================================
 * Entry point for the Node.js backend service.
 *
 * Responsibilities:
 *   - Parse JSON request bodies
 *   - Apply CORS and security headers
 *   - Mount API route handlers
 *   - Connect to MongoDB via Mongoose
 *   - Start the HTTP server on PORT
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");
const telemetryRoutes = require("./routes/telemetry");

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // allow frontend assets
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10kb" })); // guard against oversized payloads
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "MaintiViz Express Gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime().toFixed(1) + "s",
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/telemetry", telemetryRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("❌  Unhandled error:", err.stack);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const start = async () => {
  // Attempt MongoDB connection (non-blocking — server starts even if DB is down)
  connectDB();

  app.listen(PORT, () => {
    console.log(`\n🚀  MaintiViz Gateway running on http://localhost:${PORT}`);
    console.log(`📡  ML Service URL: ${process.env.ML_SERVICE_URL || "http://localhost:8000"}`);
    console.log(`🗄️   MongoDB URI:   ${process.env.MONGO_URI ? "configured" : "not set"}\n`);
  });
};

start().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
