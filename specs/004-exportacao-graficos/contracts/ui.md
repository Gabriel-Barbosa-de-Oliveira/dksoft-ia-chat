# Contrato de interface: gráficos, controle "Exportar" e cartão de arquivo

**Feature**: [spec.md](../spec.md) | **Eventos**: [sse-events.md](./sse-events.md) | **HTTP**: [http-exports.md](./http-exports.md) | **Base**: [002 / contracts/ui.md](../../002-chat-web-ui/contracts/ui.md)

Vale o design system Modernist e `.github/instructions/design.instructions.md` (escala de espaçamento, tema claro e escuro, WCAG 2.1 AA). Raio zero, réguas de 2px, rótulos alinhados à esquerda, acento vermelho só em ação principal e destaque pequeno.

## Onde cada coisa aparece (dentro do turno do assistente)

```text
[avisos de consulta]      (já existe)
[texto da resposta]       (já existe, em streaming)
[gráfico(s)]              ← novo: logo depois do texto que o comenta, na ordem dos eventos `chart`
[cartão(ões) de arquivo]  ← novo: ordem dos eventos `file`
[ações da resposta]       (Copiar já existe) + [Exportar ▾]  ← novo, só com `result` vivo
```

## Gráfico (`ChartView`)

Estrutura semântica:

```text
<figure>
  <figcaption>  título (h-nível do contexto) + subtítulo </figcaption>
  <svg role="img" aria-labelledby="titulo resumo">  <title/> <desc>summary</desc> … </svg>
  legenda (quando houver mais de 1 série ou pizza)
  <details> <summary>Ver dados em tabela</summary> <table> … </table> </details>
</figure>
```

| Regra | Detalhe |
|-------|---------|
| Tipos | Barras (verticais), linhas e pizza. Em telas estreitas, barras com muitas categorias viram **horizontais** |
| Dimensão | Largura 100% do turno (mín. 280px); `viewBox` fixo, altura proporcional; sem rolagem horizontal da página |
| Eixos | Marcações "bonitas" (1, 2, 5 × 10ⁿ), rótulos de valor abreviados (`R$ 12,3 mil`), linha de grade fina (1px) e **linha-base de 2px** |
| Rótulos do eixo x | Desbastados quando não couberem, sem sobrepor; o texto completo está na tabela |
| Valores | `currency` em R$ pt-BR; `integer` com separador de milhar |
| Séries (≤ 6) | Distinguidas por **cor + forma + rótulo**: linhas com marcadores diferentes (círculo, quadrado, triângulo, losango, cruz, estrela); barras e fatias com **padrões de hachura** distintos. A primeira série usa o acento; as demais usam as rampas neutras e variantes definidas nos tokens |
| Tema | Tokens `--chart-*` em `app-tokens.css`, com variante clara e escura; fundo do gráfico = superfície do tema; contraste ≥ 3:1 para elementos gráficos e ≥ 4,5:1 para texto, conferido por `lib/contrast.ts` nos dois temas (teste automatizado) |
| Interação | Passar o mouse ou tocar em barra, ponto ou fatia mostra dica com categoria, série e valor. A dica **nunca** é o único acesso ao dado |
| Teclado e leitor de tela | O gráfico em si não cria dezenas de paradas de tab. O equivalente acessível é o resumo (`desc`) e o botão nativo "Ver dados em tabela", que abre uma `<table>` com `<caption>`, cabeçalhos e todos os valores |
| Movimento | Sem animação obrigatória; qualquer transição respeita `prefers-reduced-motion` |
| Parcial | `partial: true` mostra o aviso "Resultado parcial" junto ao título, com texto e ícone (não só cor) |
| Falha ao desenhar | Uma `SectionBoundary` por gráfico: em erro, o gráfico some e o texto da resposta continua; sem mensagem técnica |
| Persistência | Ao reabrir uma conversa, `charts` de cada mensagem renderiza os mesmos componentes |

## Controle "Exportar" (`ExportMenu`)

- Botão `Exportar` com ícone (Lucide `file-down`), na barra de ações da resposta, **somente** se o turno tem um evento `result` e `agora < expiresAt`. Some quando expira (sem recarregar) e **não existe** em conversas reabertas pelo histórico.
- Abre um menu de três itens: `PDF`, `Excel (.xlsx)`, `Word (.docx)`. Se o turno tem gráfico, aparece uma caixa "Incluir gráfico" (desmarcada por padrão).
- Teclado: Enter/Espaço abre; setas navegam; Esc fecha e devolve o foco ao botão; Tab sai do menu. Leitor de tela: `aria-haspopup="menu"`, `aria-expanded`, itens com `role="menuitem"`.
- Ao escolher: item mostra "Gerando…" (`aria-busy`), o menu fecha e a conclusão é anunciada na região viva ("Arquivo pronto: contas-recebidas-….xlsx").
- Aviso fixo no menu: "Dados pessoais saem mascarados. Para o arquivo com dados completos, peça no chat."
- Alvos de toque ≥ 44px; em telas estreitas o menu vira lista na largura total.

## Cartão de arquivo (`FileCard`)

Conteúdo: ícone do formato, **nome**, formato, tamanho (`48 KB`), linhas (`312 linhas`), "Válido até 22:00" (com contagem regressiva textual nos últimos 5 minutos, reaproveitando `lib/countdown.ts`), selo "Dados pessoais completos" quando `containsFullPersonalData`, selo "Com gráfico" quando `includesChart`, botão **Baixar**.

| Estado | O que a pessoa vê | Ação |
|--------|-------------------|------|
| `ready` | Cartão normal | `Baixar` |
| `downloading` | "Baixando…" (`aria-busy`), botão desabilitado | — |
| `downloaded` | "Baixado" com texto e ícone | `Baixar de novo` |
| `expired` (relógio local ou 404) | "Este link expirou" (ou "Este arquivo não está mais disponível" se o 404 chegou antes do prazo) | `Gerar de novo` |
| `error` | Mensagem humana + código de suporte | `Tentar de novo` |
| `regenerating` | "Gerando de novo…" | — |

`Gerar de novo` repete `POST /exports` com o mesmo `resultId` e formato (sempre mascarado). Se o resultado também expirou (`result_not_found`), mostra: "Os dados dessa consulta não estão mais disponíveis. Refaça a pergunta e exporte em seguida."

O download usa `fetch` com o cabeçalho de acesso e salva por `Blob` (`URL.createObjectURL` e `<a download>` temporário, revogado em seguida). Nada de chave na URL.

## Textos de erro (português do Brasil, com código de suporte)

| Origem | Texto |
|--------|-------|
| `export_too_large` | "Esse resultado tem {rows} linhas e o limite por arquivo é {maxRows}. Reduza o período ou use um filtro e tente de novo." |
| `result_not_found` | "Os dados dessa consulta não estão mais disponíveis para exportar. Refaça a pergunta e exporte em seguida." |
| `nothing_to_export` | "Essa consulta não trouxe registros, então não há o que exportar." |
| `export_busy` / `rate_limited` | "Há outras exportações em andamento. Tente de novo em {n} segundos." (com contagem regressiva) |
| `export_timeout` | "A geração do arquivo demorou mais que o esperado. Tente de novo ou reduza o período." |
| `internal_error` (exportação) | "Não foi possível gerar o arquivo agora. Tente de novo." |
| Falha de rede no download | "Não foi possível baixar o arquivo. Verifique a conexão e tente de novo." |
| `unauthorized` | Segue o fluxo existente de chave recusada (volta à tela de acesso) |

Todos mostram "Código de suporte: {requestId}" e vão para a região viva, como os erros da spec 002.

## Estado e funções puras (`web/src/lib/`)

Lógica fora dos componentes e testada com `node:test`:

| Arquivo | Responsabilidade |
|---------|-----------------|
| `chart-spec.ts` | Schema zod espelho do `ChartSpec` e dos limites |
| `chart-layout.ts` | Escalas, marcações do eixo, caminhos de linha, barras e fatias, desbaste de rótulos |
| `chart-a11y.ts` | Linhas da tabela de dados, texto de dica, mapeamento série → cor, marcador e padrão |
| `chart-palette.ts` | Cores por tema a partir dos tokens, com checagem de contraste |
| `format-value.ts` | Moeda, inteiro e abreviações em pt-BR |
| `export-state.ts` | Máquina de estados do cartão (`ready → downloading → …`) e cálculo de expiração |
| `chat-reducer.ts` | Turno ganha `result`, `charts[]` e `files[]`; `LOAD_OK` mapeia `charts` do histórico; evento desconhecido é ignorado |
| `errors.ts` / `failures.ts` | Novos códigos de exportação viram `UserError` |

## Acessibilidade (verificação)

Teste de ponta a ponta com Playwright + axe, nos temas claro e escuro e em largura de celular: sem violações em gráfico, menu e cartão; foco visível; navegação completa só por teclado; resumo e tabela presentes; contraste conferido.
