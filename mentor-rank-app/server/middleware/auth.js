const db = require("../db");

// Protege o SITE inteiro com uma senha única (SITE_PASSWORD no Railway).
function requireSitePassword(req, res, next) {
  const provided = req.headers["x-site-password"] || "";
  const expected = process.env.SITE_PASSWORD || "";

  if (!expected) {
    // Se não configurou SITE_PASSWORD no Railway, libera geral (modo aberto).
    return next();
  }
  if (provided !== expected) {
    return res.status(401).json({ error: "Senha do site incorreta." });
  }
  next();
}

// Identifica QUAL mentorado está chamando a API pelo código da subconta dele
// (sem senha pessoal — é só um identificador).
function requireShop(req, res, next) {
  const shopId = req.headers["x-shop-id"];
  if (!shopId) {
    return res.status(401).json({ error: "Código da subconta ausente." });
  }
  const user = db.prepare("SELECT * FROM users WHERE shop_id = ?").get(shopId);
  if (!user) {
    return res.status(401).json({ error: "Subconta não cadastrada. Entre novamente." });
  }
  req.userId = user.id;
  req.shopId = user.shop_id;
  next();
}

module.exports = { requireSitePassword, requireShop };
