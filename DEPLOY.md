# Deploy da demo (go live)

- **Backend + MCP** → Fly.io (`Dockerfile` + `fly.toml` na raiz). O MCP roda como processo filho da API, na mesma imagem.
- **Front** → Vercel (projeto com *Root Directory* `web`, config em `web/vercel.json`).

Nunca commite segredos nem `.env`. Segredos do backend ficam só no Fly; o front só recebe a URL pública da API.

## 1. Backend no Fly.io

Pré-requisito: `flyctl` instalado e `fly auth login`.

```bash
# 1. Edite `app` em fly.toml para um nome único (ex.: dksoft-ia-chat-api-seunome)
fly launch --copy-config --no-deploy

# 2. Volume do SQLite (mesma região do fly.toml; uma única máquina)
fly volumes create data --region gru --size 1

# 3. Segredos
fly secrets set \
  OPENROUTER_API_KEY=... \
  OPENROUTER_MODEL=anthropic/claude-sonnet-4.5 \
  OPENROUTER_MODEL_FALLBACK= \
  API_TOKEN=... \
  CHAT_ACCESS_KEY="$(openssl rand -hex 32)" \
  CHAT_CORS_ORIGINS=https://SEU-PROJETO.vercel.app

# 4. Deploy
fly deploy
curl https://SEU-APP.fly.dev/health   # {"status":"ok"}
```

Guarde a `CHAT_ACCESS_KEY` gerada (o `fly secrets` não a mostra de novo): é a chave que as pessoas digitam na tela de acesso.

Notas:

- `CHAT_CORS_ORIGINS` precisa ser **exatamente** a origem do front (com `https://`, sem barra final). Mais de uma, separadas por vírgula.
- `BASE_URL`, `PORT`, `CHAT_DB` e `TRUST_PROXY` já estão em `fly.toml`.
- Mantenha **uma máquina**: o SQLite fica no volume e não é compartilhado entre máquinas. Não rode `fly scale count 2`.
- O container roda como root para conseguir escrever no volume montado.
- Logs: `fly logs`. Máquina: `fly status`.

## 2. Front na Vercel

1. Importe o repositório na Vercel e defina **Root Directory** = `web`.
2. Em *Environment Variables*, defina `VITE_API_BASE_URL=https://SEU-APP.fly.dev` (público, entra no bundle; nunca coloque chave aqui).
3. Faça o deploy. O `web/vercel.json` já cuida do fallback de SPA (rotas `/c/<uuid>` abrem ao recarregar).
4. Se a URL da Vercel mudar (domínio próprio, por exemplo), atualize `CHAT_CORS_ORIGINS` no Fly:
   `fly secrets set CHAT_CORS_ORIGINS=https://novo-dominio` (reinicia a máquina).

`VITE_API_BASE_URL` é lida no build: alterá-la exige um novo deploy do front.

## 3. Validação

1. `GET /health` responde `ok`.
2. Abra o front, informe uma chave errada ("Chave incorreta") e depois a certa.
3. Pergunte "Quais pacotes estão disponíveis?" e confira os avisos de consulta e o texto em streaming.
4. Recarregue em `/c/<uuid>` e confira que o histórico reabre.
5. `curl -N https://SEU-APP.fly.dev/chat -H "Authorization: Bearer $CHAT_ACCESS_KEY" -H "content-type: application/json" -d '{"message":"ping"}'` mostra eventos SSE sem buffer.

## Cuidados da demo

- **Dados reais**: o MVP usa um único token DKSOFT, sem separação por escola. Quem tem a chave de acesso enxerga os dados daquele token. Prefira um token de escola de teste.
- **Custo**: defina um limite de gasto na conta do OpenRouter.
- **Rate limit**: com `TRUST_PROXY=true` o limite por minuto passa a valer por IP de cliente, não global.
- **Histórico**: fica no volume. `fly volumes` lista; destruir o volume apaga as conversas.
- **Depois da demo**: rotacione a chave (`fly secrets set CHAT_ACCESS_KEY=...`) ou pause com `fly scale count 0`.
