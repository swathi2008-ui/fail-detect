/**
 * MaintiViz Edge Engine — MongoDB Connection
 * ============================================
 * Establishes a Mongoose connection to MongoDB Atlas (or local instance).
 * Implements retry logic and graceful error handling.
 */

const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI from environment variables.
 * Retries up to MAX_RETRIES times with exponential back-off.
 *
 * @param {number} retryCount - Current retry attempt (internal).
 */
const connectDB = async (retryCount = 0) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY_MS = 2000;

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are the recommended Mongoose 7+ defaults
      serverSelectionTimeoutMS: 5000, // fail fast during startup
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);

    // Log disconnection events so operators can react
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected — reconnecting …");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌  MongoDB error:", err.message);
    });
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount); // exponential back-off
      console.warn(
        `⚠️  MongoDB connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${delay}ms …`
      );
      setTimeout(() => connectDB(retryCount + 1), delay);
    } else {
      console.error(
        "❌  MongoDB unreachable after maximum retries. Continuing in degraded mode (predictions work, history disabled)."
      );
    }
  }
};

module.exports = connectDB;
