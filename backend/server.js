require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const { UPLOAD_DIR } = require("./middleware/uploadMiddleware");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "change-me") {
  console.error("Set a real JWT_SECRET in backend/.env (see .env.example).");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1);

// CSP is off so the existing frontend (inline handlers, Google Fonts, Wikipedia photos) keeps working.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
const origins = (process.env.CLIENT_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : undefined));
app.use(express.json({ limit: "100kb" }));

// API
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false, message: { message: "Too many attempts. Try again in a few minutes." } }), require("./routes/authRoutes"));
app.use("/api/auctions/:id/bids", require("./routes/bidRoutes"));
app.use("/api/auctions", require("./routes/auctionRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/uploads", require("./routes/uploadRoutes"));
app.use("/api", notFound);

// Uploaded product images
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

// Serve the frontend too, so http://localhost:5000 is the whole app (optional; ../frontend must exist).
const frontendDir = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendDir)) app.use(express.static(frontendDir));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    if (process.env.AUTO_SEED !== "false") {
      await require("./seedData").ensureDemo(); // creates demo users + sample auctions, repairs old data
    }
    app.listen(PORT, () => console.log(`AuctoBid running on http://localhost:${PORT}`));
    // While the server is running, demo products whose timer ends are renewed automatically (every 20 seconds).
    if (process.env.AUTO_SEED !== "false") {
      const { renewDemo } = require("./seedData");
      setInterval(() => renewDemo().catch((e) => console.error("Demo renew failed:", e.message)), 20000);
    }
  } catch (err) {
    console.error("Failed to start:", err.message);
    process.exit(1);
  }
})();
