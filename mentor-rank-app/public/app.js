const token = localStorage.getItem("mr_token");
const user = JSON.parse(localStorage.getItem("mr_user") || "null");

if (!token || !user) {
  window.location.href = "/login.html";
}

document.getElementById("userName").textContent = user.name;

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("mr_token");
  localStorage.removeItem("mr_user");
  window.location.href = "/login.html";
});

function fmtReais(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function api(path, options = {}) {
  const res = await fetch(`${window.API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("mr_token");
    window.location.href = "/login.html";
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na requisição.");
  return data;
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

async function loadStats() {
  const stats = await api("/api/me/stats");
  document.getElementById("levelValue").textContent = `R$ ${stats.level.current.toLocaleString("pt-BR")}`;
  document.getElementById("totalRevenue").textContent = fmtReais(stats.total_reais);
  document.getElementById("myPosition").textContent = stats.position ? `#${String(stats.position).padStart(2, "0")}` : "—";

  const pct = stats.level.progressPct.toFixed(1);
  document.getElementById("progressFill").style.width = `${pct}%`;
  document.getElementById("progressLabel").textContent =
    stats.level.next === stats.level.current
      ? "Nível máximo atingido"
      : `Progresso para R$ ${stats.level.next.toLocaleString("pt-BR")}: ${pct}%`;
}

async function loadLeaderboard() {
  const data = await api("/api/leaderboard");
  const list = document.getElementById("leaderboardList");
  list.innerHTML = "";

  if (data.leaderboard.length === 0) {
    list.innerHTML = '<p class="muted">Ainda não há vendas registradas por ninguém.</p>';
    return;
  }

  for (const entry of data.leaderboard) {
    const isMe = entry.id === user.id;
    const row = document.createElement("div");
    row.className = `row${isMe ? " me" : ""}`;
    row.innerHTML = `
      <span class="pos">${String(entry.position).padStart(2, "0")}</span>
      <span class="avatar">${initials(entry.name)}</span>
      <span class="name">${entry.name}${isMe ? " <span class=\"muted\">(você)</span>" : ""}</span>
      <span class="amount mono">${fmtReais(entry.total_reais)}</span>
    `;
    list.appendChild(row);
  }
}

async function loadKycStatus() {
  const data = await api("/api/kyc/status");
  const el = document.getElementById("kycStatus");
  const status = data.verification ? data.verification.status : "none";
  el.className = `kyc-status ${status}`;
  el.textContent = {
    none: "Não iniciada",
    pending: "Em análise",
    approved: "Aprovada",
    verified: "Aprovada",
    failed: "Falhou",
    rejected: "Reprovada",
    error: "Erro ao verificar",
  }[status] || status;
}

document.getElementById("kycSubmit").addEventListener("click", async () => {
  const document_ = document.getElementById("kycDocument").value.trim();
  const document_type = document.getElementById("kycDocType").value.trim();
  const btn = document.getElementById("kycSubmit");

  if (!document_ || !document_type) {
    alert("Preencha o documento e o tipo de documento.");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    await api("/api/kyc/verify", {
      method: "POST",
      body: JSON.stringify({ document: document_, document_type }),
    });
    await loadKycStatus();
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Verificar identidade";
  }
});

document.getElementById("saleSubmit").addEventListener("click", async () => {
  const input = document.getElementById("saleAmount");
  const amount = Number(input.value);
  if (!amount || amount <= 0) {
    alert("Informe um valor válido.");
    return;
  }
  try {
    await api("/api/sales", {
      method: "POST",
      body: JSON.stringify({ amount_reais: amount }),
    });
    input.value = "";
    await Promise.all([loadStats(), loadLeaderboard()]);
  } catch (err) {
    alert(err.message);
  }
});

(async function init() {
  try {
    await Promise.all([loadStats(), loadLeaderboard(), loadKycStatus()]);
  } catch (err) {
    console.error(err);
  }
})();
