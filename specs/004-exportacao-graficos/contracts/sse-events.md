# Contrato SSE: eventos novos no `POST /chat`

**Feature**: [spec.md](../spec.md) | **Base**: [001 / contracts/http.md](../../001-agent-api/contracts/http.md) | **Consumo**: [002 / contracts/api-consumption.md](../../002-chat-web-ui/contracts/api-consumption.md)

Três eventos **aditivos** no stream. Os eventos `meta`, `tool`, `token`, `done` e `error` e suas regras (`meta` primeiro, um único terminal) não mudam.

## `result`

Um resultado de consulta ficou disponível para exportar e para gráficos. Emitido logo **depois** do evento `tool` com `phase: "end"` e `ok: true` da consulta que o gerou.

```text
event: result
data: {"resultId":"<uuid>","label":"Contas recebidas, 01/10/2026 a 31/10/2026","rows":312,"totalRows":312,"capped":false,"expiresAt":"2026-10-31T22:21:00.000Z"}
```

| Campo | Regra |
|-------|-------|
| `resultId` | UUID do resultado vivo |
| `label` | Descrição em português, sem dado pessoal |
| `rows` | Registros guardados |
| `totalRows` | Registros devolvidos pela API (≥ `rows`) |
| `capped` | `true` se `totalRows > rows` |
| `expiresAt` | Quando o resultado deixa de estar disponível |

Só é emitido quando há **pelo menos 1 registro**. O front usa este evento para mostrar o controle "Exportar" na resposta.

## `chart`

A tool `gerar_grafico` produziu um gráfico. Emitido logo depois do `tool` `end` correspondente, **antes** dos tokens finais que o comentam (ou entre eles).

```text
event: chart
data: {"chart":{"id":"<uuid>","type":"bar","title":"Recebido por semana","subtitle":"01/10/2026 a 31/10/2026","valueKind":"currency","categories":["Sem 1","Sem 2","Sem 3","Sem 4"],"series":[{"name":"Total recebido","values":[8200.5,9100,12300,7050.25]}],"summary":"Gráfico de barras com 4 semanas; maior valor R$ 12.300,00 na Sem 3.","resultId":"<uuid>","partial":false}}
```

O objeto `chart` segue o `ChartSpec` do [data-model](../data-model.md) (seção 2). Uma resposta pode ter vários eventos `chart`.

## `file`

A tool `exportar_arquivo` gerou um arquivo. Emitido logo depois do `tool` `end` correspondente.

```text
event: file
data: {"file":{"id":"<uuid>","conversationId":"<uuid>","resultId":"<uuid>","name":"contas-recebidas-20261031-213015.xlsx","format":"xlsx","mime":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","sizeBytes":48211,"rowCount":312,"includesChart":false,"containsFullPersonalData":false,"createdAt":"2026-10-31T21:30:15.000Z","expiresAt":"2026-10-31T22:00:15.000Z","downloadPath":"/conversations/<uuid>/exports/<uuid>"}}
```

O objeto `file` segue o `FileDescriptor` do [data-model](../data-model.md) (seção 5), sem `bytes`.

## Regras do stream (acréscimos)

- Os três eventos só aparecem **entre** `meta` e o evento terminal. Nunca depois de `done` ou `error`.
- Se a pergunta termina em `error`, gráficos e arquivos já emitidos continuam válidos na tela, mas **o gráfico só entra no histórico quando o terminal é `done`** (mesma regra do par pergunta/resposta).
- O gráfico persistido no histórico é o dos eventos `chart` desta resposta, na mesma ordem.
- `file` e `result` **nunca** são persistidos.
- Nenhum dos três carrega registros brutos, dados pessoais fora do que o gráfico mostra, token ou chave.

## Compatibilidade entre versões (obrigatória)

O front de `web/` hoje rejeita evento desconhecido. Antes de publicar a API com estes eventos, o front deve **ignorar** eventos que não conhece (com aviso só em modo de desenvolvimento). Ordem de deploy: front tolerante (Vercel) → API nova (Fly). O contrato também vale ao contrário: front novo com API antiga simplesmente não recebe os eventos e não mostra controles.

## Esquema zod (espelhado em `api/src/domain/events.ts` e `web/src/lib/events.ts`)

```text
result: { resultId: uuid, label: string, rows: int ≥ 1, totalRows: int ≥ rows, capped: boolean, expiresAt: iso }
chart:  { chart: ChartSpec }
file:   { file: FileDescriptor }
```
