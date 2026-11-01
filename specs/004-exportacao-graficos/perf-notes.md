# Notas de desempenho e imagem (R2, R3, R4)

**Medição**: `node --expose-gc --import tsx api/scripts/bench-export.ts` (Node v22.23.4, Linux, worker thread real, 3 streams simulados de 20 ms). Dados sintéticos de 5 colunas (contas pagas), dados pessoais mascarados.

## R3 — tempo e laço de eventos

| Linhas | Formato | Tempo (s) | Tamanho (KB) | Atraso máx. do laço com 3 streams (ms) | RSS depois (MB) |
|---|---|---|---|---|---|
| 1.000 | PDF | 1,04 | 133 | 12 | 227 |
| 1.000 | Excel | 0,57 | 29 | 4 | 213 |
| 1.000 | Word | 0,86 | 24 | 7 | 276 |
| 5.000 | PDF | 2,07 | 625 | 5 | 307 |
| 5.000 | Excel | 0,71 | 130 | 12 | 255 |
| 5.000 | Word | 1,75 | 78 | 12 | 480 |

- **SC-001** (≤ 15 s para 1.000 linhas): atendido com folga (≤ 1,1 s).
- Limite de 5.000 linhas fica bem abaixo dos 30 s de `EXPORT_TIMEOUT_MS`; **não foi preciso** limite por formato nem mudar `EXPORT_MAX_ROWS`.
- O atraso máximo do laço de eventos foi de 12 ms: a geração em `worker_threads` não pausa os streams de chat.

## R4 — memória

20 exportações seguidas (1.000 linhas, formatos em rodízio, `gc` entre elas): RSS oscila entre 244 e 304 MB (ciclo do formato), média das 5 primeiras 265,2 MB e das 5 últimas 268,7 MB (variação de +3,5 MB): **estabiliza**. Pico observado de 480 MB (Word, 5.000 linhas); a máquina de 1 GB comporta `EXPORT_MAX_CONCURRENCY=2`, mas dois Word de 5.000 linhas simultâneos podem chegar perto de 1 GB. Se isso aparecer em produção, baixe para `EXPORT_MAX_CONCURRENCY=1` ou `EXPORT_MAX_ROWS=3000` com `fly secrets set`.

O aviso `No URL access policy defined` do pdfmake aparece no console da geração de PDF; é informativo (a geração não baixa recursos externos).

## R2 — imagem Docker

**Não validado aqui**: o ambiente desta implementação não tem daemon Docker (`docker build` falha ao conectar em `/var/run/docker.sock`). O que foi conferido sem o daemon:

- `api/assets/fonts/` (Archivo Regular/SemiBold) não é ignorado pelo `.dockerignore` nem pelo `.gitignore`, e a `COPY api ./api` do `Dockerfile` o leva para a imagem.
- `package-lock.json` da API traz `@resvg/resvg-js-linux-x64-gnu` (e arm64-gnu); a base `node:24-bookworm-slim` é glibc, compatível.
- O teste do worker real (`render/worker-pool.test.ts`, R2) gera PDF, Excel e Word com acentos e gráfico em PNG numa worker thread, rodando em `node --import tsx`, o mesmo modo do `npm start`.

**Pendente (passo manual antes do merge)**: `docker build -t dksoft-ia-chat-api .`, subir com `--env-file` fora do repositório e exportar PDF + gráfico dentro do container (quickstart, seção 7).
