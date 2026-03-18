require("dotenv").config({ path: "../.env" });
const express = require("express");
const cors = require("cors");

const uploadRouter = require("./routes/upload");
const verifyRouter = require("./routes/verify");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ──────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api", uploadRouter);
app.use("/api", verifyRouter);

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    contract: process.env.CONTRACT_ADDRESS || "not configured",
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message || "An unexpected error occurred",
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 BlockCert API server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(
    `   Contract:     ${process.env.CONTRACT_ADDRESS || "⚠️  CONTRACT_ADDRESS not set in .env"}`
  );
  console.log(
    `   Pinata:       ${process.env.PINATA_JWT ? "✅ configured" : "⚠️  PINATA_JWT not set in .env"}\n`
  );
});
