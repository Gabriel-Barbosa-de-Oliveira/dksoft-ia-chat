# Contrato das tools do agente: resultados, gráficos e arquivos

**Feature**: [spec.md](../spec.md) | **Dados**: [data-model.md](../data-model.md) | **Eventos**: [sse-events.md](./sse-events.md)

Três tools **locais** do backend, registradas junto das tools da API DKSOFT. Elas **não escrevem na API DKSOFT** (princípio VI); só leem resultados já consultados e produzem gráfico e arquivo temporários. Ficam numa lista própria (`ARTIFACT_TOOLS`), separada da `TOOL_ALLOWLIST` de consulta. Montadas **por execução** (precisam do `conversationId` e do texto da última mensagem da pessoa). Só existem com `ARTIFACTS_ENABLED=true`.

## Mudanças nas tools de consulta existentes

O resumo que o modelo recebe de toda tool que devolve lista de registros ganha o campo `resultId` (e só ele). Exemplo (campos novos em destaque):

```json
{ "resultId": "<uuid>", "total": 312, "somas": { "valor_pago": 41250.75 }, "registros": [ "…até 40 linhas…" ], "truncado": true, "omitidos": 272 }
```

O resumo continua cortado em `TOOL_RESULT_MAX_ROWS` e sem contatos nas listas; os registros **completos** ficam no armazém de resultados. O prompt avisa que, mesmo com `truncado: true`, o arquivo e o gráfico usam todos os registros.

## Tool 1: `resultados_disponiveis`

Entrada: nenhuma.

Saída ao modelo (texto): lista dos resultados vivos desta conversa, do mais recente para o mais antigo, ou "Nenhum resultado disponível para exportar nesta conversa."

```text
1. resultId=<uuid> · Contas recebidas, 01/10/2026 a 31/10/2026 · 312 registros · há 4 min
2. resultId=<uuid> · Parcelas em aberto da matrícula 1234 · 2 registros · há 11 min
```

Sem artefato, sem evento SSE.

## Tool 2: `gerar_grafico`

Entrada (`ChartRequest`, ver [data-model §3](../data-model.md)):

```text
resultId?: uuid            // omitido = resultado mais recente
type: "bar" | "line" | "pie"
title: string (1–120)
groupBy: string            // campo do registro; nunca cpf, email ou telefone
granularity?: "day" | "week" | "month"
measure: { kind: "count" } | { kind: "sum", field: string }
splitBy?: string           // vira séries (até 6); não vale para pizza
sort?: "x" | "value"
limit?: int (1–24)
```

Descrição da tool (resumo que o modelo lê): "Mostra um gráfico na conversa a partir dos registros já consultados. Informe só como agrupar e o que medir; os valores são calculados pelo sistema. Use para comparar categorias, mostrar evolução no tempo ou distribuição. Não use para um valor único."

Saída ao modelo (texto): `Gráfico exibido: "<título>". <summary>. Comente o gráfico em até 2 frases, sem repetir todos os números.`

Artefato (vai para o evento `chart`): o `ChartSpec` validado.

Falhas viram **texto para o modelo** (nunca exceção que derruba a execução), com mensagem pronta para repassar:

| Situação | Texto devolvido |
|----------|-----------------|
| Sem resultado vivo | "Não há dados consultados nesta conversa para montar o gráfico. Ofereça fazer a consulta primeiro." |
| Menos de 2 categorias (pizza: 1 é aceito) | "Os dados têm só 1 categoria; um gráfico não ajudaria. Responda em texto." |
| Campo inexistente | "O campo '<campo>' não existe neste resultado. Campos disponíveis: …" |
| Campo proibido (CPF, e-mail, telefone) | "Não é permitido agrupar por dados de contato." |
| Medida não numérica | "O campo '<campo>' não é numérico; use contagem ou outro campo." |

## Tool 3: `exportar_arquivo`

Entrada:

```text
resultId?: uuid                     // omitido = resultado mais recente
formato: "pdf" | "xlsx" | "docx"
incluirGrafico?: boolean            // inclui o gráfico mais recente deste resultado, se houver
dadosPessoaisCompletos?: boolean    // só vale se o servidor reconhecer pedido explícito no texto da pessoa
```

Descrição da tool: "Gera um arquivo (PDF, Excel ou Word) com os registros já consultados e mostra o cartão de download na conversa. Use só quando a pessoa pedir arquivo, planilha, PDF ou Word. Diga qual resultado será exportado. Nunca digite valores: o arquivo usa os registros guardados. Dados pessoais saem mascarados, a menos que a pessoa peça explicitamente os dados completos."

**Regra estrutural de dados pessoais** (FR-008, risco R5): o servidor só honra `dadosPessoaisCompletos: true` se `asksForFullPersonalData(textoDaÚltimaMensagemDaPessoa)` for verdadeiro (função pura: precisa combinar um termo de completude, como "completo", "inteiro", "sem máscara" ou "sem mascarar", com um alvo, como "cpf", "e-mail", "telefone" ou "dados pessoais"). Caso contrário o arquivo sai **mascarado** e o texto devolvido ao modelo avisa isso. O modelo não consegue contornar.

Saída ao modelo (texto): `Arquivo gerado: <nome> (<formato>, <linhas> linhas, <tamanho>), válido até <hh:mm>. Resultado exportado: <label>. Dados pessoais: <mascarados | completos>. O cartão de download já aparece na conversa; confirme em uma frase e diga qual resultado foi exportado.`

Artefato (vai para o evento `file`): o `FileDescriptor`.

Falhas viram texto para o modelo:

| Situação | Texto devolvido |
|----------|-----------------|
| Sem resultado vivo (nunca consultou, expirou ou conversa reaberta) | "Os dados dessa consulta não estão mais disponíveis para exportar. Explique e ofereça refazer a consulta." |
| Resultado sem registros | "O resultado não tem registros; não gere arquivo. Ofereça ajustar a consulta." |
| Linhas acima do limite | "O resultado tem N linhas e o limite por arquivo é M. Explique e sugira reduzir o período ou filtrar." |
| Ocupado | "Há exportações em andamento. Peça para a pessoa tentar de novo em alguns segundos." |
| Tempo esgotado | "A geração demorou demais. Sugira reduzir o período e tentar de novo." |
| Erro interno | "Não foi possível gerar o arquivo agora. Peça para tentar de novo." (o `requestId` já vai no log, não no texto) |
| `incluirGrafico` sem gráfico | O arquivo sai só com os dados e o texto avisa: "Não havia gráfico para incluir." |

## Mapeamento para eventos

```text
ToolMessage(name="gerar_grafico",   artifact=ChartSpec)      → AgentEvent {type:"chart", chart}  → SSE `chart`
ToolMessage(name="exportar_arquivo", artifact=FileDescriptor) → AgentEvent {type:"file",  file}   → SSE `file`
ToolMessage de tool de consulta com artifact {resultId,…}     → AgentEvent {type:"result", …}   → SSE `result`
```

`agent.ts` valida cada artefato com zod antes de emitir; artefato inválido vira ausência de evento (o texto continua).

## Acréscimos ao prompt do sistema (regras 11 a 15)

11. **Gráficos**: use `gerar_grafico` quando a pergunta envolver comparação entre categorias, evolução no tempo ou distribuição, ou quando a pessoa pedir gráfico. Não use para valor único nem lista curta. Nunca escreva valores do gráfico: informe só o agrupamento e a medida.
12. **Arquivos**: use `exportar_arquivo` só quando a pessoa pedir arquivo, PDF, Excel/planilha ou Word. Diga qual resultado será exportado (use `resultados_disponiveis` se houver mais de um). Nunca monte arquivo com valores digitados por você.
13. **Dados pessoais em arquivos**: só marque `dadosPessoaisCompletos` quando a mensagem atual pedir isso explicitamente; o sistema confere. Por padrão o arquivo sai mascarado.
14. **Sem dados**: se não houver resultado disponível (nada consultado, expirado ou conversa antiga), explique e ofereça refazer a consulta; não gere arquivo nem gráfico.
15. **Limites**: se o arquivo for grande demais ou ocupado, explique o motivo em uma frase e sugira reduzir o período ou tentar de novo.

As regras 1 a 10 da spec 001 continuam (somente leitura, valores exatos, sem inventar). Teste de contrato: `system-prompt.test.ts` confere a presença de cada regra.

## Limites e proteções

- Máximo de chamadas das três tools por execução entra na conta existente de `MAX_TOOL_CALLS_PER_RUN` (10).
- As tools não passam pelo limitador da API DKSOFT (não chamam essa API); exportação tem sua própria fila (`EXPORT_MAX_CONCURRENCY`).
- Nenhuma das três recebe nem devolve registros brutos ao modelo.
