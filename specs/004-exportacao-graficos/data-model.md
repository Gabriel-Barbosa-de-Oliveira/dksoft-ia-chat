# Data Model: Exportação de Arquivos e Gráficos no Chat

**Feature**: [spec.md](./spec.md) | **Plano**: [plan.md](./plan.md) | **Pesquisa**: [research.md](./research.md)

Tudo abaixo é validado com zod na fronteira (princípio II). Os tipos de `api/` e `web/` são espelhados à mão, como já acontece com `events.ts`. Nomes de campos em inglês no código, textos para a pessoa em português.

## Visão geral

```text
Conversa (SQLite, já existe)
 ├─ Mensagem do assistente ── artifacts.charts[] ── Especificação de gráfico   (persiste)
 └─ Resultado consultado (memória, 1 h) ──┬─ Arquivo exportado (memória, 30 min)
                                          └─ Especificação de gráfico viva (memória, 1 h)
Registro de funcionamento (SQLite) ── export_runs (sem conteúdo)
```

## 1. Resultado consultado (`StoredResult`) — memória

Registros brutos devolvidos por uma tool de consulta da API DKSOFT durante a conversa. Única fonte de arquivos e gráficos.

| Campo | Tipo | Regra |
|-------|------|-------|
| `id` | UUID | `resultId`; gerado no servidor; é o único identificador que o modelo e o front manipulam |
| `conversationId` | UUID | Vínculo obrigatório; qualquer acesso com outra conversa responde "não encontrado" |
| `toolName` | string | Uma das tools da allowlist (`dksoft_*` ou `financeiro_*_periodo`) |
| `label` | string | Descrição legível em português, sem dados pessoais (ex.: "Contas recebidas, 01/10/2026 a 31/10/2026") |
| `filters` | objeto | Período (`dataInicial`, `dataFinal`) e filtros de texto usados na consulta (`aluno`, `pacote`), apenas para o cabeçalho do arquivo |
| `rows` | lista de registros | Objetos como a API devolveu (campos podem ser nulos); no máximo `RESULT_MAX_ROWS` |
| `totalRows` | inteiro | Quantidade devolvida pela API antes do teto |
| `capped` | booleano | `true` quando `totalRows > rows.length` (teto de armazenamento); vira aviso de resultado parcial nos arquivos |
| `createdAt`, `expiresAt` | data/hora ISO | `expiresAt = createdAt + RESULT_TTL_MS` (padrão 1 h) |

**Regras**
- Só entra no armazém resultado de tool que devolve lista de registros (mesma detecção de `shape-result.ts`, extraída para uma função pura `extractRows`). Resposta de erro ou texto livre não vira resultado.
- Teto por conversa: 10 resultados vivos (o mais antigo sai primeiro). Teto global de memória: `RESULT_STORE_MAX_MB` (o mais antigo sai primeiro).
- Remoção: ao expirar (verificação no acesso e varredura a cada minuto) e ao reiniciar o servidor. Nunca vai a disco.
- Os registros de listas `list_*` ficam **com** CPF, e-mail e telefone no armazém (o corte é só no que o modelo vê); o arquivo aplica a máscara na saída (seção 4).

## 2. Especificação de gráfico (`ChartSpec`) — contrato com o front e os arquivos

| Campo | Tipo | Regra |
|-------|------|-------|
| `id` | UUID | Gerado no servidor |
| `type` | `"bar" \| "line" \| "pie"` | |
| `title` | string 1–120 | Obrigatório |
| `subtitle` | string ≤ 160, opcional | Período e filtros |
| `xLabel`, `yLabel` | string ≤ 60, opcionais | Rótulos de eixo (ignorados na pizza) |
| `valueKind` | `"currency" \| "integer"` | Define formatação (R$ ou inteiro) |
| `categories` | lista de string 1–24 | Rótulos do eixo x (ou nomes das fatias). Únicos |
| `series` | lista 1–6 de `{ name: string, values: number[] }` | `values.length === categories.length`; números finitos; pizza: exatamente 1 série, valores ≥ 0, até 8 fatias (excedente soma em "Outros") |
| `summary` | string 1–400 | Resumo em texto gerado pelo servidor (texto alternativo), ex.: "Gráfico de barras: 4 semanas; maior valor R$ 12.300,00 na semana de 08/10." |
| `resultId` | UUID | Resultado de onde os valores vieram |
| `partial` | booleano | Herdado do resultado (`capped`) |

**Regras de validação** (função pura `validateChartSpec`): tamanhos acima, valores finitos, sem NaN, nomes de série únicos, `values` com no máximo 2 casas decimais para `currency`. Especificação inválida é descartada com erro de domínio (`ChartNotPossibleError`) e nunca chega ao front.

**Persistência**: a especificação é copiada para `messages.artifacts` da resposta do assistente (seção 6) e fica também, por `RESULT_TTL_MS`, ligada ao resultado, para ser incluída em arquivos (`includeChart`).

## 3. Requisição de gráfico (`ChartRequest`) — modelo → servidor

O modelo escolhe *o que* mostrar; o servidor calcula *os números*.

| Campo | Tipo | Regra |
|-------|------|-------|
| `resultId` | UUID, opcional | Omitido = resultado mais recente da conversa |
| `type` | `bar \| line \| pie` | |
| `title` | string 1–120 | |
| `groupBy` | string | Campo do registro usado nas categorias; precisa existir no resultado; **não** pode ser CPF, e-mail ou telefone |
| `granularity` | `day \| week \| month`, opcional | Só quando `groupBy` é campo de data; agrupa e ordena cronologicamente |
| `measure` | `{ kind: "count" } \| { kind: "sum", field: string }` | `sum` exige campo numérico |
| `splitBy` | string, opcional | Segunda dimensão que vira séries (até 6 valores distintos, resto em "Outros"); não permitido na pizza |
| `sort` | `"x" \| "value"`, opcional | Padrão: cronológico para datas, `value` decrescente para categorias |
| `limit` | inteiro 1–24, opcional | Maiores N categorias; o resto entra em "Outros" |

**Cálculo** (função pura `buildChartSpec(result, request)`): somas em centavos inteiros (mesma técnica de `shape-result.ts`), contagens exatas, ordenação estável, rótulos de data em `dd/mm` ou `mm/aaaa`. Falhas previsíveis: poucos dados (menos de 2 categorias, exceto pizza com 1), campo inexistente, medida não numérica, campo proibido → `ChartNotPossibleError` com texto que o modelo repassa à pessoa.

## 4. Tabela de exportação (`ExportTable`) — derivada, não guardada

Produzida por função pura `buildExportTable(result, { maskPersonalData, now })`.

| Campo | Tipo | Regra |
|-------|------|-------|
| `title` | string | Ex.: "Contas recebidas" |
| `subtitle` | string | Período e filtros em texto |
| `generatedAt` | data/hora | Fuso America/Sao_Paulo no cabeçalho |
| `columns` | lista de `{ key, label, kind }` | `kind` ∈ `text \| integer \| money \| date \| datetime`; rótulo e tipo vêm do **dicionário de colunas** |
| `rows` | lista de listas de células | Células tipadas: `string`, `number`, `Date` ou `null`; nunca "null" como texto |
| `totals` | `{ rowCount, sums: { [coluna money]: number } }` | Calculados sobre as mesmas linhas, em centavos |
| `notes` | lista de string | Avisos: resultado parcial (`capped`), dados mascarados, período consolidado |
| `maskedPersonalData` | booleano | `true` quando CPF/e-mail/telefone foram mascarados |

**Dicionário de colunas** (`column-dictionary.ts`, puro): mapeia campos conhecidos (`valor_pago`, `data_pagamento`, `vencimento`, `aluno`, `responsavel`, `pacote`, `centro_custo`, `historico`, `cpf`, `email`, `telefone`, …) para rótulo em português, tipo e flag `sensitive`. Campos desconhecidos: rótulo derivado do nome (primeira letra maiúscula, `_` → espaço) e tipo `text`. Os campos exatos vêm de `data/api-types.ts` e da documentação da API (campos conhecidos por registro nas contas recebidas/pagas).

**Máscara (FR-008)**: com `maskPersonalData = true`, colunas `sensitive` passam por `maskPii` (últimos 2 dígitos, e-mail `***@***`), e campos de texto livre (`historico`) também passam por `maskPii`. Com `false`, nada é mascarado. O valor `false` só é aceito quando `asksForFullPersonalData(últimaMensagemDaPessoa)` for verdadeiro.

**Valores**: números ficam números e datas ficam datas nas células (o Excel soma e ordena); a formatação em reais e dd/mm/aaaa é aplicada pelo formato de coluna (Excel) ou pelo texto (PDF e Word). Texto de célula que começa com `=`, `+`, `-` ou `@` é sempre gravado como célula de **texto** (nunca como fórmula); um teste abre a planilha gerada e confere que nenhuma célula do arquivo tem fórmula.

## 5. Arquivo exportado (`StoredFile`) — memória

| Campo | Tipo | Regra |
|-------|------|-------|
| `id` | UUID | `fileId` |
| `conversationId`, `resultId` | UUID | Vínculos; download só com a conversa de origem |
| `format` | `"pdf" \| "xlsx" \| "docx"` | |
| `name` | string | `<assunto>-<AAAAMMDD-HHmmss>.<ext>`; assunto vem de uma lista fixa por tool (ex.: `contas-recebidas`), **nunca** de dado pessoal |
| `mime` | string | Tipo MIME do formato |
| `bytes` | `Buffer` | Conteúdo; nunca sai em log |
| `sizeBytes` | inteiro | |
| `rowCount` | inteiro | |
| `includesChart` | booleano | |
| `containsFullPersonalData` | booleano | `true` só quando o pedido explícito foi reconhecido |
| `createdAt`, `expiresAt` | data/hora ISO | `expiresAt = createdAt + EXPORT_TTL_MS` (padrão 30 min) |

**Descritor público** (`FileDescriptor`, o que vai ao front e ao modelo): tudo acima **menos** `bytes`, mais `downloadPath` (`/conversations/<conversationId>/exports/<fileId>`).

**Regras**: teto de `FILE_STORE_MAX_MB` (remove o mais antigo); no máximo 20 arquivos vivos por conversa; remoção ao expirar e ao reiniciar; nunca em disco.

## 6. Mensagem (SQLite, já existe) — coluna nova

`messages.artifacts TEXT NULL`: JSON `{ "charts": ChartSpec[] }` apenas nas mensagens do assistente que exibiram gráfico. Migração idempotente na abertura do banco:

```text
se PRAGMA table_info(messages) não tem "artifacts": ALTER TABLE messages ADD COLUMN artifacts TEXT
```

`StoredMessage` ganha `charts?: ChartSpec[]`; `appendPair(id, user, assistant, artifacts?)`. Linhas antigas ficam com `NULL` e continuam válidas. Ao ler, o JSON é revalidado com zod; se estiver corrompido, o gráfico é omitido e o texto da resposta continua íntegro.

## 7. Registro de funcionamento (SQLite) — `export_runs`

| Coluna | Tipo | Regra |
|--------|------|-------|
| `request_id` | TEXT | Identificador da requisição |
| `conversation_id` | TEXT | |
| `kind` | TEXT | `export` ou `chart` |
| `detail` | TEXT | Formato (`pdf`/`xlsx`/`docx`) ou tipo de gráfico (`bar`/`line`/`pie`) |
| `origin` | TEXT | `chat` (tool) ou `button` (POST /exports) |
| `rows` | INTEGER | Quantidade de linhas ou de pontos |
| `duration_ms` | INTEGER | ≥ 0 |
| `outcome` | TEXT | `ok`, `too_large`, `timeout`, `not_found`, `error` |
| `explicit_pii` | INTEGER | 1 se saiu com dados completos por pedido explícito, senão 0 |
| `created_at` | TEXT | |

Sem conteúdo de arquivo, sem nome de arquivo, sem `fileId`, sem endereço de link, sem dado pessoal (FR-023, SC-007).

## 8. Estados e transições

**Resultado**: `vivo → expirado` (por tempo, ou removido por teto/reinício). Não volta.

**Pedido de exportação**: `recebido → (rejeitado: resultado inexistente | grande demais | ocupado) | gerando → pronto | falhou | tempo esgotado`.

**Cartão de arquivo no front**: `pronto → baixando → baixado` (pode baixar de novo até expirar) · `pronto → expirado` (relógio local a partir de `expiresAt`, ou resposta 404 do download) · `baixando → erro` (com nova tentativa) · `expirado → "Gerar de novo"` (volta a `gerando`, usando o mesmo `resultId` se ainda vivo; senão, orienta a refazer a consulta).

**Controle "Exportar" no front**: visível enquanto o turno tiver um evento `result` e `agora < expiresAt` do resultado; some depois, e não existe em conversas reabertas pelo histórico (FR-024).

## 9. Relação com os requisitos

| Entidade | Requisitos |
|----------|-----------|
| `StoredResult` | FR-002, FR-011, FR-012, FR-024 |
| `ChartRequest` / `ChartSpec` | FR-013 a FR-021 |
| `ExportTable` + dicionário + máscara | FR-006, FR-007, FR-008, FR-009 |
| `StoredFile` + descritor | FR-003, FR-004, FR-005 |
| `messages.artifacts` | FR-019 |
| `export_runs` | FR-023, SC-007 |
