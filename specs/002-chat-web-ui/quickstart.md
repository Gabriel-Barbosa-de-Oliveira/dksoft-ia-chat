# Quickstart: Interface Web do Chat

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Guia para subir o front e validar cada história da spec. Os comandos abaixo valem depois que as tarefas de `/speckit-tasks` e `/speckit-implement` criarem `web/`; o roteiro existe antes para guiar o que "pronto" significa.

## Pré-requisitos

- Node 24 LTS e npm.
- O backend da spec 001 funcionando: `cp api/.env.example api/.env`, preencher `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `API_TOKEN`, `BASE_URL` e `CHAT_ACCESS_KEY` (32+ caracteres), depois `npm --prefix api run dev` (porta 3000). Nunca commitar nem colar o `.env`.
- Em `api/.env`, `CHAT_CORS_ORIGINS` precisa conter a origem do front. O padrão `http://localhost:5173` já serve para o servidor de desenvolvimento do Vite.
- Para o E2E: navegadores do Playwright (`npx --prefix web playwright install chromium`).

## Subir o front

```bash
npm --prefix web install
cp web/.env.example web/.env      # opcional: VITE_API_BASE_URL (padrão http://localhost:3000)
npm --prefix web run dev          # http://localhost:5173
```

`VITE_API_BASE_URL` é público (entra no bundle) e **nunca** recebe chave.

## Portões automáticos (sempre verdes antes de commitar)

```bash
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web test             # node:test: lib/, api/ com fetch falso, teste de tokens
npm --prefix web run build
npm --prefix web run test:e2e     # node:test + Playwright + servidor falso do contrato 001
```

Esperado: tudo verde. O `test` cobre, entre outros, o decodificador SSE (quadros partidos, `\r\n`), a validação de eventos, todos os caminhos do reducer, a tradução de cada erro, o limite de 4000 caracteres em unidades UTF-16, o tema, a rolagem, a contagem regressiva e a prévia. O teste de tokens falha com hex ou `px` literal em CSS próprio e com par de cores abaixo do contraste mínimo. O `test:e2e` roda as histórias da spec nos dois temas, em 320, 768 e 1280 px, com verificação do axe em cada tela e estado; ele não acessa rede externa (só `localhost`).

## Validação manual por história

Use o backend real, uma chave válida e dados de teste conhecidos.

### US1: entrar e perguntar (SC-001, SC-002, SC-003, SC-006)

1. Abra `http://localhost:5173` sem chave: aparece só a tela de acesso, sem conversa nem histórico.
2. Informe uma chave errada: mensagem "Chave incorreta" junto ao campo, o campo segue preenchível. Informe a certa: entra no chat. Em nenhum momento a chave aparece na tela nem na barra de endereço.
3. Envie "Quais pacotes estão disponíveis?": a pergunta e o indicador de atividade aparecem em até 1 s; avisos de consulta chegam com ícone e texto; o texto cresce aos poucos; ao fim aparece "Copiar".
4. Role para cima durante uma resposta longa: a lista não se move e surge "Ir para o fim".
5. Envie outra pergunta e acione "Parar": o texto parcial fica marcado "Resposta interrompida" e o compositor volta a funcionar.
6. No DevTools (Application): em `sessionStorage` só há `dksoft.accessKey`; em `localStorage`, só `dksoft.theme` se você trocou de tema. Nenhum texto de conversa em lugar algum.

### US2: retomar conversas (SC-007)

1. Faça uma pergunta sobre um aluno e depois "e qual a mais antiga?": a segunda se apoia na primeira.
2. Recarregue a página: a mesma conversa reabre com o histórico, e o endereço é `/c/<uuid>`.
3. Abra o painel de histórico: a conversa aparece com data e hora e, após instantes, o trecho da primeira pergunta. "Nova conversa" volta ao estado vazio; acionar uma sugestão só preenche o campo.
4. Abra `/c/00000000-0000-0000-0000-000000000000` e `/c/abc`: "Conversa não encontrada" com "Iniciar nova conversa".

### US3: erros e recuperação (SC-004, SC-005)

Com o servidor falso do E2E (`npm --prefix web run fake-api -- --scenario <nome>`) ou desligando o backend:

| Cenário | Esperado |
|---------|----------|
| Backend desligado | "Sem conexão" + "Tentar novamente"; o texto digitado continua no campo |
| Chave trocada no servidor durante o uso | Volta à tela de acesso; a pergunta continua no campo depois de entrar |
| Origem fora da allowlist | "Endereço não autorizado" + código de suporte |
| Limite de uso (`429`) | Contagem regressiva; o envio libera ao zerar; a pergunta é mantida |
| Erro no meio do stream | Texto parcial mantido, marcado como incompleto, com "Tentar novamente" |
| Conexão cortada sem `done` | "Conexão interrompida" (nunca fica esperando) |
| `done` com `partial: true` | Aviso visível "Resultado parcial" |
| Falha ao listar conversas | Erro só no painel de histórico; o chat segue utilizável |

Em todo erro: sem rastro técnico, sem texto cru da API; com código de suporte quando o servidor o enviou.

### US4: tema, teclado, responsivo e leitor de tela (SC-008 a SC-012)

1. Troque o tema do sistema operacional: o chat acompanha. Escolha "Escuro" manualmente, recarregue: a escolha persiste.
2. Percorra o fluxo inteiro só com teclado (entrar, perguntar, parar, abrir histórico, tentar novamente, trocar de tema): foco sempre visível, ordem lógica, sem armadilha fora das folhas modais.
3. Reduza a janela a 320 px e use o modo de dispositivo do navegador: sem rolagem horizontal, alvos de 44 px, histórico em folha que não cobre o campo em digitação. Uma resposta com tabela rola só dentro da tabela.
4. Ative "reduzir movimento" no sistema: o ícone de carregamento deixa de girar.
5. Com um leitor de tela: as consultas e o fim da resposta são anunciados sem reler o texto token a token; erros são anunciados como alerta.
6. Compare as telas com o design system Modernist (checklist em [contracts/ui.md](./contracts/ui.md#revisão-visual-contra-o-modernist-checklist-de-aceite)).

## Hospedagem estática (produção)

- Servir `web/dist` com **fallback para `index.html`** em qualquer rota (necessário para `/c/:id` ao recarregar).
- Cabeçalhos recomendados: `Referrer-Policy: no-referrer` e a CSP do item 21 da [pesquisa](./research.md#21-segurança-do-front). Como tema e fontes são arquivos próprios, a CSP não precisa de `unsafe-inline`.
- Incluir a origem final do front em `CHAT_CORS_ORIGINS` do backend.
- Mesma origem para front e API (proxy reverso) é opcional; elimina o CORS mas não muda o front.

## Mapa dos critérios de sucesso

| Critério | Onde se verifica |
|----------|------------------|
| SC-001 (feedback em 1 s) | E2E com servidor falso lento; manual US1 passo 3 |
| SC-002 (primeira pergunta em 30 s) | Manual US1, cronometrado |
| SC-003 (estados distinguíveis) | E2E por estado + revisão visual |
| SC-004, SC-005 (erros e rascunho) | E2E e `lib/errors` (unidade); manual US3 |
| SC-006 (sem chave nem conversa no navegador) | E2E inspeciona `sessionStorage`/`localStorage`/URL; manual US1 passo 6 |
| SC-007 (recarregar reabre) | E2E e manual US2 passo 2 |
| SC-008 (teclado) | E2E de teclado; manual US4 passo 2 |
| SC-009 (axe AA) | E2E com axe em cada tela, estado e tema |
| SC-010 (320/768/1280, 44 px) | E2E em três larguras |
| SC-011 (sem execução de HTML/script) | Teste de unidade do `Markdown` + E2E com resposta maliciosa do servidor falso |
| SC-012 (só tokens) | Teste de tokens + oxlint + revisão visual |
