const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Mesmos degraus de nível que apareciam no protótipo original (em reais).
const LEVELS = [1000, 2000, 3000, 4000, 5000, 10000, 20000, 50000];

function levelForAmount(cents) {
  const reais = cents / 100;
  let current = LEVELS[0];
  let next = LEVELS[LEVELS.length - 1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (reais >= LEVELS[i]) current = LEVELS[i];
    if (reais < LEVELS[i]) {
      next = LEVELS[i];
      break;
    }
    next = LEVELS[i];
  }
  const progressPct =
    next === current ? 100 : Math.min(100, Math.max(0, ((reais - 0) / next) * 100));
  return { current, next, progressPct };
}

// GET /api/leaderboard - ranking real, calculado a partir da soma de vendas
router.get("/leaderboard", (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.name,
              COALESCE(SUM(s.amount_cents), 0) AS total_cents
       FROM users u
       LEFT JOIN sales s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY total_cents DESC, u.created_at ASC`
    )
    .all();

  const ranked = rows.map((row, index) => ({
    position: index + 1,
    id: row.id,
    name: row.name,
    total_cents: row.total_cents,
    total_reais: row.total_cents / 100,
  }));

  res.json({ leaderboard: ranked });
});

// GET /api/me/stats - dados reais do usuário logado (nível, progresso, posição)
router.get("/me/stats", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, COALESCE(SUM(s.amount_cents), 0) AS total_cents
       FROM users u
       LEFT JOIN sales s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY total_cents DESC, u.created_at ASC`
    )
    .all();

  const position = rows.findIndex((r) => r.id === req.userId) + 1;
  const me = rows.find((r) => r.id === req.userId) || { total_cents: 0 };
  const level = levelForAmount(me.total_cents);

  res.json({
    total_cents: me.total_cents,
    total_reais: me.total_cents / 100,
    position: position || null,
    level,
  });
});

// POST /api/sales - registra uma venda real ligada ao usuário logado
// Nota: no futuro, o ideal é essa rota ser chamada por um webhook do seu
// gateway de pagamento (Stripe, NexusPag, etc), não digitada manualmente.
router.post("/sales", requireAuth, (req, res) => {
  const { amount_reais, description } = req.body || {};
  const amount = Number(amount_reais);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Informe um valor de venda válido em reais." });
  }

  const amountCents = Math.round(amount * 100);
  const result = db
    .prepare(
      "INSERT INTO sales (user_id, amount_cents, description, source) VALUES (?, ?, ?, 'manual')"
    )
    .run(req.userId, amountCents, description || null);

  res.status(201).json({ id: result.lastInsertRowid, amount_cents: amountCents });
});

// GET /api/sales - histórico de vendas do usuário logado
router.get("/sales", requireAuth, (req, res) => {
  const sales = db
    .prepare("SELECT * FROM sales WHERE user_id = ? ORDER BY sold_at DESC")
    .all(req.userId);
  res.json({ sales });
});

module.exports = router;
