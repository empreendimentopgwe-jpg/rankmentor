# Classificação de Mentor — versão real

App funcional com:
- Cadastro/login de usuários reais (senha com hash, token JWT)
- Ranking calculado a partir de **vendas reais** salvas no banco (SQLite)
- Verificação de identidade (KYC) via **NexusPag**, chamada só pelo servidor
  (a chave da API nunca aparece no navegador)

## 1. Instalar

```bash
cd mentor-rank-app
npm install
cp .env.example .env
```

Edite o `.env` e preencha:
- `JWT_SECRET`: qualquer string longa e aleatória
- `NEXUSPAG_API_KEY`: sua chave real da NexusPag (a que você mandou, `nxp_live_...`)
- `PUBLIC_APP_URL`: a URL pública do seu servidor (ex: `https://seuapp.com`),
  usada para receber o webhook de resultado do KYC

## 2. Rodar localmente

```bash
npm start
```

Abra `http://localhost:3000/login.html`, crie uma conta e comece a registrar
vendas para ver o ranking mudar em tempo real.

## 3. Como o KYC funciona aqui

1. O front-end chama `POST /api/kyc/verify` no **seu próprio servidor**,
   sem nenhuma chave.
2. O servidor (`server/routes/kyc.js`) é quem faz a chamada para
   `https://nexuspag.com/api/kyc/verify`, usando `NEXUSPAG_API_KEY` do `.env`.
3. O resultado fica salvo na tabela `kyc_verifications`.
4. Quando a NexusPag processa a verificação de forma assíncrona, ela chama
   de volta `POST /api/kyc/webhook` (que você configura no painel deles como
   `PUBLIC_APP_URL + /api/kyc/webhook`) e o status é atualizado.

**Nunca** coloque a `x-api-key` em código que roda no navegador — qualquer
pessoa consegue abrir o DevTools e copiá-la.

## 4. Deploy: Netlify (front-end) + Railway (backend)

O projeto já está preparado para essa divisão: front-end estático servido
pelo Netlify (com domínio grátis tipo `meuapp.netlify.app`), backend Node
rodando no Railway.

### 4.1 Backend no Railway

1. Crie uma conta em railway.app e clique em **New Project → Deploy from
   GitHub repo** (suba esse projeto pro GitHub primeiro) ou **Empty Project**
   e faça upload manual.
2. Nas variáveis de ambiente do serviço, adicione as mesmas do `.env`:
   `JWT_SECRET`, `NEXUSPAG_API_KEY`, `NEXUSPAG_BASE_URL`, `PUBLIC_APP_URL`,
   `ALLOWED_ORIGINS` (deixe `ALLOWED_ORIGINS` em branco por enquanto, você
   completa depois de saber a URL do Netlify).
3. Railway detecta o `Procfile` e roda `node server/index.js` sozinho.
4. **Importante — disco persistente**: por padrão, o Railway recria o
   sistema de arquivos a cada deploy, e isso apagaria `data.sqlite`. Nas
   configurações do serviço, adicione um **Volume** e monte em `/app` (ou
   na pasta raiz do projeto) para o banco sobreviver aos deploys.
5. Depois do deploy, copie a URL pública (algo como
   `https://mentor-rank-api-production.up.railway.app`). É essa URL que vai
   em `PUBLIC_APP_URL` e no `config.js` do front-end.

### 4.2 Front-end no Netlify

1. Antes de subir, edite `public/config.js` e troque
   `TROQUE-PELA-URL-DO-SEU-BACKEND` pela URL real do Railway do passo
   anterior.
2. No Netlify: **Add new site → Deploy manually** e arraste a pasta
   `public/` (ou conecte o repositório do GitHub — nesse caso o
   `netlify.toml` já diz pra ele publicar a pasta `public`).
3. Você recebe um domínio grátis tipo `meuapp.netlify.app`. Acesse
   `https://meuapp.netlify.app/login.html` pra testar.
4. Volte no Railway e preencha `ALLOWED_ORIGINS=https://meuapp.netlify.app`
   (sem barra no final), redeploy o backend. Isso é o que permite que só o
   seu front-end chame sua API.

### 4.3 Checklist final

- [ ] Backend no ar no Railway, com volume persistente configurado
- [ ] `config.js` do front-end apontando pra URL do Railway
- [ ] `ALLOWED_ORIGINS` no Railway apontando pra URL do Netlify
- [ ] Testou criar conta, registrar venda e ver o ranking mudar
- [ ] Testou o botão de verificação KYC

## 5. Próximos passos para ficar 100% real

- **Vendas automáticas**: hoje existe um botão para registrar venda manual
  (`POST /api/sales`). O ideal é substituir isso por um webhook do seu
  gateway de pagamento, que chama sua API quando uma venda é confirmada —
  a mesma lógica de `kyc/webhook` serve de modelo.
- **Deploy**: qualquer serviço que rode Node.js funciona (Railway, Render,
  Fly.io, um VPS, ou o próprio Replit). Como o banco é um arquivo SQLite
  (`data.sqlite`), garanta que o disco seja persistente entre deploys — em
  produção com mais tráfego, considere migrar para PostgreSQL.
- **HTTPS**: obrigatório em produção, tanto para proteger os tokens de
  login quanto para o webhook da NexusPag funcionar corretamente.
