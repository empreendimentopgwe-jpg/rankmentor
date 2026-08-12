// Troque essa URL pela URL pública do seu backend no Railway
// depois do deploy (ex: "https://mentor-rank-api.up.railway.app").
// Enquanto estiver testando local com "npm start", deixe como está.
window.API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://friendly-dedication-production-af16.up.railway.app";
