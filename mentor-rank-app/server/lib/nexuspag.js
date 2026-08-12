// Fala com a API da NexusPag para pegar o total real vendido por uma subconta.

async function getShopTotal(shopId) {
  const url = `${process.env.NEXUSPAG_BASE_URL}/api/shops/${shopId}/transactions?limit=100`;
  const res = await fetch(url, {
    headers: { "x-api-key": process.env.NEXUSPAG_API_KEY },
  });

  if (!res.ok) {
    if (res.status === 404) return null; // subconta não existe
    throw new Error(`NexusPag retornou ${res.status}`);
  }

  const data = await res.json();
  const rows = data.data || [];

  // Soma o valor líquido (net_amount) de tudo que é pagamento recebido (pix_in).
  // Splits recebidos (split_received) não contam como venda própria.
  const totalCents = rows
    .filter((t) => t.type === "pix_in")
    .reduce((sum, t) => sum + Math.round((t.net_amount ?? t.amount) * 100), 0);

  return { totalCents, raw: data };
}

module.exports = { getShopTotal };
