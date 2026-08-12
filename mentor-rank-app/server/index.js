require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const leaderboardRoutes = require("./routes/leaderboard");
const kycRoutes = require("./routes/kyc");

const app = express();

// Aceita chamadas apenas do(s) domínio(s) do seu front-end (Netlify).
// Configure ALLOWED_ORIGINS no .env, separado por vírgula se tiver mais de um.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // permite chamadas sem "origin" (ex: curl, health checks)
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Origem não permitida pelo CORS."));
    },
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api", leaderboardRoutes);
app.use("/api", kycRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
