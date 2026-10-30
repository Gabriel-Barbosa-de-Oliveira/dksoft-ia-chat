# Quickstart: validar a API do Agente de Chat

**Feature**: [spec.md](./spec.md) | **Contrato**: [contracts/http.md](./contracts/http.md) | **Modelo**: [data-model.md](./data-model.md)

Guia para provar, ponta a ponta, que a feature funciona. Os testes automáticos cobrem tudo sem rede; as seções 3 em diante usam o modelo e a API DKSOFT reais e são manuais.

## 1. Pré-requisitos

- Node 24 LTS.
- Conta no OpenRouter com uma chave e a escolha de **um modelo com suporte a *tool calling* e streaming** (e, opcionalmente, um segundo para reserva). O identificador do modelo não é fixado aqui.
- Token e URL base da API DKSOFT (a URL termina em `/api/v1`).
- Dependências do MCP instaladas: `npm --prefix mcp install`.

## 2. Verificação automática (sem rede)

```bash
npm --prefix mcp test
npm --prefix api install
npm --prefix api run typecheck
npm --prefix api test
```

Esperado: tudo verde. Cobre, entre outros: ordem retry/fallback, divisão de períodos, soma e corte de resultados, mascaramento, chave de acesso, CORS, SSE com servidor real e histórico por conversa.

## 3. Configuração

```bash
cp api/.env.example api/.env     # preencher os valores; o arquivo não é commitado
```

Variáveis obrigatórias: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `API_TOKEN`, `BASE_URL`, `CHAT_ACCESS_KEY` (mínimo 32 caracteres). As demais estão em [data-model.md](./data-model.md#appconfig-saída-de-loadconfig).

```bash
npm --prefix api run dev          # API em http://localhost:3000
export KEY="<valor de CHAT_ACCESS_KEY>"
```

## 4. Cenários de aceite

Use `curl -N` para ver o stream chegando.

**US1 — pergunta com consulta e resposta aos poucos**

```bash
curl -N -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"message":"Quais pacotes existem?"}'
```

Esperado: `meta`, depois `tool` (início/fim), vários `token` e um `done`. Conferir que os itens citados existem de fato na API. Repetir com um aluno conhecido (parcelas em aberto) e com contas recebidas de um período curto: o **total e a soma** citados precisam bater com a consulta direta. Pergunta sem consulta ("o que você consegue fazer?") não deve gerar evento `tool`.

**US2 — contexto da conversa**

```bash
curl -N -X POST http://localhost:3000/chat -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"message":"Parcelas em aberto do aluno de matrícula <M>","conversationId":"<id do meta anterior>"}'
curl -N -X POST http://localhost:3000/chat -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"message":"e qual a mais antiga?","conversationId":"<mesmo id>"}'
curl -H "Authorization: Bearer $KEY" http://localhost:3000/conversations/<mesmo id>/messages
```

Esperado: a segunda resposta fala do mesmo aluno sem pedir a matrícula; o histórico lista as 4 mensagens em ordem. Com `conversationId` inexistente: `404 conversation_not_found`.

**US3 — acesso e dados pessoais**

```bash
curl -i -X POST http://localhost:3000/chat -H "Content-Type: application/json" -d '{"message":"oi"}'      # sem chave → 401
curl -i -X POST http://localhost:3000/chat -H "Authorization: Bearer errada" -H "Content-Type: application/json" -d '{"message":"oi"}'   # chave errada → 401 idêntico
curl -i -X OPTIONS http://localhost:3000/chat -H "Origin: https://nao-autorizada.example" -H "Access-Control-Request-Method: POST"        # → 403
```

Perguntar por um aluno usando CPF e, depois, inspecionar a saída do processo e a tabela `runs`: o CPF, e-mail e telefone não podem aparecer em claro, e nem o token da DKSOFT nem a chave do OpenRouter devem aparecer em lugar nenhum.

**US4 — falhas e limites**

- Pedido financeiro de 75 dias (ex.: "quanto recebemos de 1º de agosto a 15 de outubro?"): deve funcionar, com 3 consultas internas e um total consolidado. Pedido acima de 90 dias: o assistente pede para reduzir o período.
- Resultado muito grande (um mês movimentado): a resposta traz o total e a soma corretos, avisa que mostra apenas parte, e o evento `done` vem com `"partial": true`.
- Modelo principal indisponível (por exemplo, `OPENROUTER_MODEL` com id inexistente e reserva válido): a pergunta ainda é respondida, e `done.model` mostra o reserva.
- Pedido de alteração ("baixe a parcela do aluno X"): o assistente explica que só consulta.

## 5. Critérios de pronto

- Seções 2 e 4 passam.
- Os 8 critérios de sucesso do [spec](./spec.md#measurable-outcomes) foram observados; SC-002 e SC-003 com o modelo real escolhido.
- Nenhum segredo em `git status` (o `.env` e o arquivo `.db` estão no `.gitignore`).
