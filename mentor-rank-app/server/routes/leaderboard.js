const express = require("express");
const db = require("../db");
const { requireShop } = require("../middleware/auth");
const { getShopTotal } = require("../lib/nexuspag");

const router = express.Router();

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
  const progressPct = next === current ? 100 : Math.min(100, Math.max(0, (reais / next) * 100));
  return { current, next, progressPct };
}

// Busca o total de todo mundo cadastrado, em paralelo, e monta o ranking.
async function buildRanking() {
  const users = db.prepare("SELECT * FROM users").all();

  const results = await Promise.all(
    users.map(async (u) => {
      try {
        const r = await getShopTotal(u.shop_id);
        return { id: u.id, name: u.name, total_cents: r ? r.totalCents : 0 };
      } catch {
        return { id: u.id, name: u.name, total_cents: 0 };
      }
    })
  );

  results.sort((a, b) => b.total_cents - a.total_cents);
  return results.map((row, index) => ({
    position: index + 1,
    id: row.id,
    name: row.name,
    total_cents: row.total_cents,
    total_reais: row.total_cents / 100,
  }));
}

// GET /api/leaderboard - ranking real, ao vivo, direto da NexusPag
router.get("/leaderboard", async (req, res) => {
  try {
    const ranked = await buildRanking();
    res.json({ leaderboard: ranked });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível calcular o ranking agora." });
  }
});

// GET /api/me/stats - nível, posição e total do mentorado logado
router.get("/me/stats", requireShop, async (req, res) => {
  try {
    const ranked = await buildRanking();
    const me = ranked.find((r) => r.id === req.userId) || { total_cents: 0, position: null };
    const level = levelForAmount(me.total_cents);
    res.json({
      total_cents: me.total_cents,
      total_reais: me.total_cents / 100,
      position: me.position || null,
      level,
    });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível calcular suas estatísticas agora." });
  }
});

module.exports = router;
