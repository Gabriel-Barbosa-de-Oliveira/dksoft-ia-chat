<!--
Sync Impact Report
- Version change: (nova) → 1.0.0
- Origem: adaptada da constitution do OpsPilot (unipds-ia, módulo 04) para o dksoft-ia-chat.
- Diferenças em relação à origem:
  - Servidor HTTP: Fastify (no lugar de Express).
  - Segurança por Padrão: tokens (`API_TOKEN`, `OPENROUTER_API_KEY`) nunca chegam ao front nem ao
    modelo; dados pessoais de alunos mascarados em logs; API DKSOFT tratada como somente leitura.
  - Novo princípio IX (Escopo de MVP): um único token da API e sem multi-tenant nesta fase.
  - Stack: LangChain/LangGraph 1.x; MCP existente em `mcp/` (stdio) consumido pelo agente.
- Templates requiring updates: nenhum; CLAUDE.md criado em sincronia com esta constitution.
- Follow-up TODOs: n/a
-->

# DKSOFT IA Chat Constitution

## Core Principles

### I. Camadas Explícitas
Camadas padrão MVC (Model, Service, Controller). Dependências fluem em uma única direção:
http → controller → service → model. O domínio (regras de negócio) NÃO realiza IO diretamente;
IO fica restrito às camadas de service e model (inclui chamadas à API DKSOFT, ao OpenRouter e
ao banco).
Rationale: mantém o domínio testável em isolamento e evita acoplamento entre transporte (HTTP) e
regras de negócio.

### II. Validação na Fronteira
Toda entrada externa (HTTP, variáveis de ambiente, respostas da API DKSOFT e do OpenRouter) DEVE
ser validada com zod antes de virar domínio. Dados que cruzam a fronteira sem passar por um
schema zod são tratados como bug.
Rationale: garante que o domínio opera apenas sobre dados já sanitizados e tipados, eliminando
validações defensivas espalhadas pelo código.

### III. Erros de Domínio
Falhas previsíveis DEVEM ser modeladas como classes de erro de domínio, nunca como strings ou
códigos soltos. A tradução para status HTTP/eventos de erro do stream acontece somente na borda
(controller), nunca dentro do domínio ou do service.
Rationale: mantém o domínio livre de detalhes de transporte e centraliza a política de resposta a
erros em um único ponto.

### IV. Funções Puras
Lógica de domínio é escrita preferencialmente como funções puras (mesma entrada, mesma saída, sem
efeitos colaterais). Efeitos colaterais (rede, banco, filesystem, tempo, aleatoriedade) DEVEM
ficar isolados nas camadas de service/model.
Rationale: funções puras são triviais de testar sem mocks pesados e reduzem bugs de estado
oculto.

### V. Teste Obrigatório (NON-NEGOTIABLE)
Nenhuma lógica nova entra sem teste (`node:test` via `tsx`). `npm run typecheck` e `npm test`
DEVEM estar sempre verdes antes de qualquer merge. Testes não acessam rede: modelo, MCP e API
DKSOFT são injetados como fakes.
Rationale: TypeScript `strict` mais testes automatizados são a rede de segurança do projeto; sem
eles, alterações em um agente LangGraph são difíceis de validar manualmente.

### VI. Segurança por Padrão
Segredos NUNCA são commitados no repositório. O arquivo `.env` NUNCA é lido pelo agente ou por
ferramentas automatizadas. `API_TOKEN` (DKSOFT) e `OPENROUTER_API_KEY` existem somente no
backend: não chegam ao front, nem ao prompt, nem às respostas do modelo, nem aos logs. A API
DKSOFT é tratada como somente leitura: nenhuma tool do agente altera dados. Dados pessoais de
alunos (CPF, e-mail, telefone) são mascarados em logs e só vão ao modelo quando necessários à
pergunta. O chat exige chave de acesso, e CORS é restrito por allowlist exata.
Rationale: com um único token, quem alcança o chat alcança todos os dados; as barreiras precisam
ser estruturais, não dependentes do julgamento do modelo em tempo de execução.

### VII. Spec Antes de Código
Mudanças relevantes seguem o fluxo do Spec Kit: `/speckit.specify` → `/speckit.plan` →
`/speckit.tasks` → `/speckit.implement`, com revisão humana entre as fases. Specs são versionadas
junto ao código em `specs/`.
Rationale: força alinhamento sobre o "o quê" e o "por quê" antes de gastar esforço de
implementação, e deixa rastro auditável de decisões.

### VIII. Pequeno e Reversível
Cada tarefa cabe em um commit. Mudanças grandes são decompostas em incrementos pequenos e
revertíveis independentemente.
Rationale: reduz o raio de impacto de um erro e facilita review, bisect e rollback.

### IX. Escopo de MVP
Nesta fase há um único token da API DKSOFT e nenhum multi-tenant, perfil de usuário, cofre de
tokens ou cota por cliente. O código NÃO deve impedir essas evoluções (nada de token global
espalhado: o token entra por injeção em um único ponto), mas elas só entram por spec própria.
Rationale: entrega valor cedo sem construir hoje o que ainda não foi pedido, mantendo o caminho
aberto para multi-cliente.

## Stack Tecnológica Obrigatória

- Node 24 LTS
- TypeScript ESM, `strict`
- zod na fronteira (HTTP, env, respostas externas)
- Testes com `node:test` via `tsx`
- Fastify como servidor HTTP (`app.inject()` nos testes); streaming por SSE
- SQLite via `node:sqlite` (`DatabaseSync`) como banco: arquivo local (caminho configurável via
  env), sem servidor externo; `:memory:` é o modo padrão em testes
- LangChain/LangGraph (1.x) sobre OpenRouter para o agente, com modelo de reserva configurável
- MCP (`@modelcontextprotocol/sdk`) em `mcp/` expondo a API DKSOFT; o agente consome essas tools
  via `@langchain/mcp-adapters`

### Frontend (`web/`)

- Vite + React + TypeScript `strict`, como pacote npm separado em `web/` (dependências isoladas
  da API)
- zod valida toda resposta e todo evento da API antes de virar estado
- Lógica em funções puras em `web/src/lib/`, testadas com `node:test` via `tsx`; componentes ficam
  finos
- CSS com tokens (espaçamento em escala, cores semânticas, dark mode) conforme
  `.github/instructions/design.instructions.md`

Mudar qualquer item desta stack é uma decisão arquitetural e exige amendment desta constitution.

## Fluxo de Desenvolvimento & Quality Gates

- `npm test` e `npm run typecheck` DEVEM passar antes de qualquer commit, em cada pacote alterado
  (`api/`, `web/`; `mcp/` quando ganhar testes).
- Specs, planos e tarefas geradas pelo Spec Kit vivem em `specs/` e são versionadas como qualquer
  outro artefato do repositório.
- Trabalho de feature acontece em branch própria (`feat/NNN-nome`), nunca direto na `master`.

## Governance

Esta constitution tem precedência sobre qualquer outra prática, convenção ou preferência
individual dentro do projeto. Em caso de conflito, a constitution vence.

Amendments (mudança de princípio, adição/remoção de seção, ou mudança de stack obrigatória)
exigem: (1) registro explícito do racional da mudança, (2) atualização deste documento com o Sync
Impact Report correspondente, e (3) bump de versão semântico:
- MAJOR: remoção ou redefinição incompatível de um princípio.
- MINOR: novo princípio ou seção adicionada, ou expansão material de uma diretriz existente.
- PATCH: clarificação, correção de texto, ou refinamento não-semântico.

Toda PR/review DEVE verificar conformidade com os princípios acima. Complexidade que viole um
princípio (ex.: IO dentro do domínio, entrada não validada, ausência de teste) precisa ser
justificada explicitamente na PR ou corrigida antes do merge. O uso do dia a dia é guiado por
`CLAUDE.md`, que deve permanecer consistente com esta constitution.

**Version**: 1.0.0 | **Ratified**: 2026-10-30 | **Last Amended**: 2026-10-30
