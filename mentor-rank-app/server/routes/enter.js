const express = require("express");
const db = require("../db");
const { getShopTotal } = require("../lib/nexuspag");

const router = express.Router();

// POST /api/enter { name, shop_id }
// Sem senha: valida o código da subconta direto na NexusPag e cadastra
// (ou reconhece) o mentorado.
router.post("/enter", async (req, res) => {
  const { name, shop_id } = req.body || {};

  if (!name || !shop_id) {
    return res.status(400).json({ error: "Nome e código da subconta são obrigatórios." });
  }

  try {
    const result = await getShopTotal(shop_id.trim());
    if (result === null) {
      return res.status(404).json({ error: "Código de subconta não encontrado na NexusPag." });
    }
  } catch (err) {
    return res.status(502).json({ error: "Não foi possível confirmar sua subconta agora. Tente de novo." });
  }

  const existing = db.prepare("SELECT * FROM users WHERE shop_id = ?").get(shop_id.trim());
  const user = existing
    ? (db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name.trim(), existing.id), existing)
    : db.prepare("INSERT INTO users (name, shop_id) VALUES (?, ?)").run(name.trim(), shop_id.trim());

  const userId = existing ? existing.id : user.lastInsertRowid;
  res.status(200).json({ user: { id: userId, name: name.trim(), shop_id: shop_id.trim() } });
});

module.exports = router;
