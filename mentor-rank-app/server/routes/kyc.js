const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/kyc/verify
// O front-end chama ESTA rota (sem chave nenhuma). É o servidor quem fala
// com a NexusPag usando a chave secreta guardada em process.env.
router.post("/kyc/verify", requireAuth, async (req, res) => {
  const { document, document_type } = req.body || {};

  if (!document || !document_type) {
    return res.status(400).json({ error: "document e document_type são obrigatórios." });
  }

  const externalId = `user-${req.userId}-${Date.now()}`;
  const webhookUrl = `${process.env.PUBLIC_APP_URL}/api/kyc/webhook`;

  // Registra a tentativa como "pending" antes de chamar o provedor
  const insert = db
    .prepare(
      `INSERT INTO kyc_verifications (user_id, external_id, document_type, status)
       VALUES (?, ?, ?, 'pending')`
    )
    .run(req.userId, externalId, document_type);

  try {
    const response = await fetch(`${process.env.NEXUSPAG_BASE_URL}/kyc/verify`, {
      method: "POST",
      headers: {
        "x-api-key": process.env.NEXUSPAG_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document,
        document_type,
        external_id: externalId,
        webhook_url: webhookUrl,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      db.prepare(
        `UPDATE kyc_verifications
         SET status = 'failed', provider_response = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(JSON.stringify(data), insert.lastInsertRowid);

      return res.status(response.status).json({
        error: "A NexusPag recusou a verificação.",
        details: data,
      });
    }

    const status = data.status || "pending";
    db.prepare(
      `UPDATE kyc_verifications
       SET status = ?, provider_response = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(status, JSON.stringify(data), insert.lastInsertRowid);

    res.json({ external_id: externalId, status, provider_response: data });
  } catch (err) {
    db.prepare(
      `UPDATE kyc_verifications
       SET status = 'error', provider_response = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(JSON.stringify({ message: err.message }), insert.lastInsertRowid);

    res.status(502).json({ error: "Não foi possível falar com a NexusPag agora." });
  }
});

// GET /api/kyc/status - status mais recente do usuário logado
router.get("/kyc/status", requireAuth, (req, res) => {
  const latest = db
    .prepare(
      `SELECT * FROM kyc_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(req.userId);

  res.json({ verification: latest || null });
});

// POST /api/kyc/webhook - a NexusPag chama aqui quando o status muda
// (aprovado / reprovado após análise assíncrona)
router.post("/kyc/webhook", express.json(), (req, res) => {
  const { external_id, status } = req.body || {};
  if (!external_id || !status) {
    return res.status(400).json({ error: "external_id e status são obrigatórios." });
  }

  db.prepare(
    `UPDATE kyc_verifications
     SET status = ?, provider_response = ?, updated_at = datetime('now')
     WHERE external_id = ?`
  ).run(status, JSON.stringify(req.body), external_id);

  res.json({ received: true });
});

module.exports = router;
