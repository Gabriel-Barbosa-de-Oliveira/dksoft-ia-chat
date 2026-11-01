# Quickstart: validar Exportação de Arquivos e Gráficos

**Feature**: [spec.md](./spec.md) | **Plano**: [plan.md](./plan.md) | **Contratos**: [contracts/](./contracts/)

Guia para provar, ponta a ponta, que a feature funciona. Não repete contratos nem esquemas: veja os links. Nenhum segredo vai em arquivo versionado; use variáveis de ambiente (`CHAT_ACCESS_KEY` etc., nunca leia nem commite `.env`).

## Pré-requisitos

- Node 24 LTS e dependências instaladas: `npm --prefix api ci` e `npm --prefix web ci`.
- `api/.env` preenchido a partir de `api/.env.example`, incluindo as variáveis novas (lista em [plan.md](./plan.md#configuração-nova)): `ARTIFACTS_ENABLED=true` e os limites de exportação.
- Fontes Archivo (TTF) presentes em `api/assets/fonts/` (tarefa de fundação).
- Para o roteiro com dados reais: um token DKSOFT de escola de teste (o MVP usa um único token).

## 1. Verificações automáticas (sempre verdes antes de commit)

```bash
npm --prefix api run typecheck
npm --prefix api test
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web test
npm --prefix web run test:e2e     # servidor falso com result/chart/file; inclui axe nos dois temas
```

Esperado: tudo passa, sem acesso à rede (modelo, MCP e API DKSOFT são fakes). Os testes dos geradores abrem de volta o `.xlsx` e o `.docx` (zip + XML) e conferem estrutura, células numéricas e ausência de fórmulas; no PDF conferem cabeçalho, número de páginas e texto extraído.

## 2. Subir o ambiente local

```bash
npm --prefix api run dev          # porta 3000
npm --prefix web run dev          # porta 5173; VITE_API_BASE_URL aponta para a API
```

Abra o front, informe a chave de acesso e use o roteiro abaixo.

## 3. Roteiro de validação manual

| # | Passo | Resultado esperado | Cobre |
|---|-------|--------------------|-------|
| A | Pergunte "contas recebidas de 01/10/2026 a 31/10/2026" | Resposta com tabela/totais e botão **Exportar** na resposta | US1, US3 |
| B | Peça "me manda isso em Excel" | Cartão de arquivo com nome, formato, tamanho, linhas, "Válido até …". O assistente diz qual resultado exportou | FR-001, FR-003, FR-012 |
| C | Baixe e abra o `.xlsx` | Título, data/hora de geração, período, colunas em português, datas dd/mm/aaaa, valores em reais; ordenar e somar a coluna de valores funciona; totais batem com a conversa | FR-006, FR-007, SC-002, SC-004 |
| D | Repita pedindo PDF e Word | Mesmos registros e totais nos três formatos | US1 cenário 2 |
| E | Em um resultado com alunos, exporte pelo **botão** e depois peça por texto | Arquivos com o mesmo conteúdo; CPF, e-mail e telefone **mascarados** nos dois | FR-008, FR-010 |
| F | Peça "exporta em Excel com o CPF completo" | Arquivo com CPF completo; cartão mostra o selo "Dados pessoais completos". Peça de novo **sem** dizer "completo": volta a sair mascarado | FR-008, SC-007 |
| G | Pergunte "como foram os recebimentos por semana em outubro?" | Texto + gráfico de barras ou linhas com título, eixos e legenda; valores batem com a tabela | US2, SC-002 |
| H | Pergunte "quantos alunos há no pacote X?" | Só texto, sem gráfico | US2 cenário 3, SC-005 |
| I | Abra "Ver dados em tabela" e navegue só pelo teclado | Tabela com todos os valores; foco visível; leitor de tela lê o resumo | FR-018, SC-006 |
| J | Alterne tema claro/escuro e reduza a janela para ~360px | Gráfico legível, séries distinguíveis sem cor, sem rolagem horizontal da página | FR-018 |
| K | Peça "exporta em PDF com o gráfico" depois de G | PDF e Word com o mesmo gráfico e a tabela; no Excel o gráfico entra como imagem ao lado da tabela | US4, FR-021 |
| L | Recarregue a página e reabra a conversa pelo histórico | Os gráficos reaparecem; **não** há botão "Exportar" nas respostas antigas; pedir arquivo gera a explicação e a oferta de refazer a consulta | FR-019, FR-024 |
| M | Consulte um período que dê mais linhas que `EXPORT_MAX_ROWS` (ou reduza o limite no `.env` para 5) e peça arquivo | Mensagem com o limite e o tamanho, sugestão de reduzir o período; nenhum arquivo cortado | FR-005, US5 |
| N | Peça arquivo numa conversa sem consulta | Explica que não há dados e oferece consultar; sem arquivo vazio | FR-011 |

## 4. Verificações de borda (linha de comando)

Use variáveis de ambiente para a chave e os identificadores (não cole segredos em arquivos).

```bash
# 401 sem chave (corpo idêntico ao de chave errada)
curl -i -X POST "$API/exports" -H 'content-type: application/json' -d '{}'

# 201 com chave válida (ids vêm dos eventos `result` do stream)
curl -s -X POST "$API/exports" -H "Authorization: Bearer $CHAT_ACCESS_KEY" \
  -H 'content-type: application/json' \
  -d "{\"conversationId\":\"$CONV\",\"resultId\":\"$RES\",\"format\":\"xlsx\"}"

# download com a chave: 200, attachment, Cache-Control: no-store
curl -i -o /tmp/arquivo.xlsx -H "Authorization: Bearer $CHAT_ACCESS_KEY" "$API$DOWNLOAD_PATH"

# download sem chave ou com outra conversa na rota: recusado (401 / 404)
curl -i "$API$DOWNLOAD_PATH"
curl -i -H "Authorization: Bearer $CHAT_ACCESS_KEY" "$API/conversations/$OUTRA_CONV/exports/$FILE"
```

Esperado (SC-003): sem chave → `401`; conversa errada ou arquivo vencido → `404` com corpo igual; resultado vencido no `POST /exports` → `404 result_not_found`.

Para testar expiração sem esperar, suba a API com `EXPORT_TTL_MS=5000 RESULT_TTL_MS=10000`, gere, aguarde e repita o download e o `POST`.

## 5. Privacidade e logs (SC-007)

1. Com `fly logs` (ou o log local) aberto, repita os passos B, E e F.
2. Esperado: nenhuma linha contém CPF, e-mail, telefone, nome de arquivo, `fileId` ou conteúdo de arquivo. Aparecem só `requestId`, formato, quantidade de linhas, duração e resultado.
3. Conferir a tabela de funcionamento: `SELECT kind, detail, origin, rows, outcome, explicit_pii FROM export_runs ORDER BY created_at DESC LIMIT 10;` (no banco local de teste). `explicit_pii` é `1` só no passo F.
4. Reiniciar a API e tentar baixar um arquivo anterior: `404` (nada em disco).

## 6. Desempenho e memória (R3, R4)

1. Gere resultado de cerca de 1.000 linhas e exporte nos três formatos: cada arquivo deve ficar pronto em até **15 s** (SC-001).
2. Gere resultado no limite (5.000 linhas) em PDF e Word e anote o tempo. Se passar de 30 s, ajustar o limite por formato (configuração, sem nova spec).
3. Durante as gerações, mantenha 3 streams de chat abertos em outra aba: os eventos devem continuar chegando sem pausa visível (worker thread fora do laço principal).
4. Observe a memória da máquina (`fly status`/métricas) após 20 exportações seguidas: deve se estabilizar (tetos dos armazéns).

## 7. Imagem Docker (R2)

```bash
docker build -t dksoft-ia-chat-api .
docker run --rm -p 3000:3000 --env-file <arquivo-fora-do-repo> dksoft-ia-chat-api
```

Esperado: exportar PDF e gerar gráfico (PNG) dentro do container funcionam, com acentos e texto do gráfico visíveis (fontes Archivo embarcadas; a imagem não tem fontes de sistema).

## 8. Regressão do MVP (SC-008, FR-026)

Com `ARTIFACTS_ENABLED=false`: nenhuma rota nova responde (`404 not_found`), nenhuma tool nova é registrada, nenhum evento novo é emitido, e os fluxos das specs 001 e 002 passam como antes (`npm --prefix api test`, `npm --prefix web run test:e2e`). Com `true`, as conversas sem pedido de arquivo ou gráfico se comportam exatamente como antes.

## 9. Ordem de publicação

1. Publicar o **front** tolerante a eventos desconhecidos (Vercel).
2. Publicar a **API** (Fly), `fly deploy` com `ARTIFACTS_ENABLED=true`. Mantém uma máquina (resultados e arquivos vivem em memória).
3. Validar o roteiro das seções 3 e 5 em produção com token de escola de teste.
4. Reversão rápida: `fly secrets set ARTIFACTS_ENABLED=false` (reinicia a máquina e desliga a feature sem novo deploy).
