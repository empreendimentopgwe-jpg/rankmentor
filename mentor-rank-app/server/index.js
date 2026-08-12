require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const { requireSitePassword } = require("./middleware/auth");
const enterRoutes = require("./routes/enter");
const leaderboardRoutes = require("./routes/leaderboard");
const kycRoutes = require("./routes/kyc");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Origem não permitida pelo CORS."));
    },
  })
);
app.use(express.json());

// Toda a API fica atrás da senha única do site (SITE_PASSWORD no Railway).
app.use("/api", requireSitePassword);

app.use("/api", enterRoutes);
app.use("/api", leaderboardRoutes);
app.use("/api", kycRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
