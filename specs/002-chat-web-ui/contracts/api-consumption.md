# Contrato de consumo: o que o front usa da API do agente

**Feature**: [spec.md](../spec.md) | **Contrato do servidor**: [001 / contracts/http.md](../../001-agent-api/contracts/http.md) | **Dados**: [data-model.md](../data-model.md)

Esta spec **não altera** o contrato da 001. Este arquivo registra apenas como o front o consome, para que mudanças futuras no servidor tenham um checklist do que quebra no cliente.

Base: `VITE_API_BASE_URL` (padrão `http://localhost:3000`). Toda chamada, exceto `GET /health` (que o front não usa), leva `Authorization: Bearer <chave>`. A origem do front precisa estar em `CHAT_CORS_ORIGINS` no servidor. O CORS da 001 já permite `GET`, `POST`, `OPTIONS`, os cabeçalhos `Authorization` e `Content-Type` e expõe `X-Request-Id` e `X-Conversation-Id`; o front **não depende** desses cabeçalhos expostos, porque o `meta` do stream e o corpo de erro trazem os mesmos valores.

## Uso por endpoint

| Endpoint | Quando o front chama | Como trata a resposta |
|----------|---------------------|----------------------|
| `GET /conversations?limit=1` | Na tela de acesso, para validar a chave | `200` aceita e guarda a chave; `401` mostra "chave incorreta" junto ao campo; `403`, rede e `5xx` viram o erro correspondente na própria tela |
| `GET /conversations?limit=20&offset=n` | Ao abrir o painel de histórico e em "Carregar mais" | Valida com `ConversationPage`; `hasMore = conversations.length === limit` |
| `GET /conversations/:id/messages` | Ao abrir `/c/:id`, ao escolher uma conversa e para a prévia da lista | `200` valida com `MessagesResponse`; `404` → "conversa não encontrada"; `401` → tela de acesso |
| `POST /chat` | A cada pergunta | Ver abaixo |

## `POST /chat`

Requisição:

```text
POST {base}/chat
Authorization: Bearer <chave>
Content-Type: application/json
Accept: text/event-stream

{ "message": "<1..4000, já com trim>", "conversationId": "<uuid, omitido na primeira pergunta>" }
```

O front só envia depois de `validateMessage` aprovar o texto, então um `400 invalid_body` por tamanho ou vazio não deveria ocorrer; se ocorrer, mantém o texto e informa.

### Respostas antes do stream (JSON)

| Status | `error` | Tratamento no front |
|--------|---------|---------------------|
| 400 | `invalid_body` | `UserError` `invalid_body`; o rascunho é mantido; `issues` é ignorado |
| 401 | `unauthorized` | Limpa a chave, volta à tela de acesso com o rascunho preservado |
| 403 | `origin_not_allowed` | `UserError` `origin_not_allowed`, sem ação de nova tentativa útil; mostra o código de suporte |
| 404 | `conversation_not_found` | Estado "conversa não encontrada" com "Iniciar nova conversa" |
| 429 | `rate_limited` | Contagem regressiva de `retryAfterSeconds` (padrão 60 se ausente); o envio é liberado ao zerar; a pergunta é mantida |
| 500 / outros | `internal_error` ou corpo inválido | `server_error` ou `unexpected_response`, com "Tentar novamente" |

Toda resposta de erro traz `requestId` no corpo; ele vira o código de suporte. Se o corpo não for JSON válido, não há código de suporte.

### Stream (`200`, `text/event-stream`)

Regras que o front assume, todas do contrato 001:

1. O primeiro evento é `meta`; depois só `tool`, `token` e **um** evento terminal, `done` ou `error`.
2. Cada quadro tem `event:` e uma linha `data:` com JSON, e termina em linha em branco. O decodificador também tolera `\r\n`, quadros partidos entre pedaços de rede e linhas de comentário (`:`), que ignora.
3. Evento desconhecido ou `data` fora do schema: o front **ignora o quadro** se o `event` for desconhecido (compatibilidade futura) e **encerra com `unexpected_response`** se o `event` for conhecido mas o `data` não casar com o schema.
4. `done.partial = true` marca o turno como parcial e mostra o aviso visível (FR-009).
5. Depois do terminal o front fecha o leitor e ignora qualquer byte restante.
6. O texto do evento `error.message` **não é exibido**; o front usa a própria mensagem por `code` (FR-016).
7. Fim do corpo sem evento terminal → `connection_lost`. Se a pergunta não terminar (sem `done` nem `error`) em 150 s contados do envio, o front aborta o pedido → `client_timeout`; é o tempo máximo do servidor (120 s) mais margem, e vale mesmo que a conexão continue aberta e silenciosa.
8. `abort()` do cliente fecha a conexão; o servidor cancela a execução e registra `aborted`, sem gravar o par (contrato 001).

Sequência típica (a mesma do contrato, repetida aqui por ser o que o decodificador e o reducer exercitam nos testes):

```text
event: meta
data: {"requestId":"…","conversationId":"…"}

event: tool
data: {"phase":"start","name":"dksoft_find_student","label":"Buscando o aluno pela matrícula…"}

event: tool
data: {"phase":"end","name":"dksoft_find_student","label":"Buscando o aluno pela matrícula…","ok":true}

event: token
data: {"text":"O aluno "}

event: done
data: {"requestId":"…","conversationId":"…","model":"…","durationMs":4210,"partial":false}
```

## Fixtures de teste

`web/src/lib/__fixtures__/` guarda os exemplos acima e variações (quadro partido ao meio, `\r\n`, `done.partial`, `error` com cada `code`, erro HTTP de cada status, corpo de erro inválido). São a fonte dos testes de `sse`, `events`, `chat-reducer` e `errors`, e o servidor falso do E2E (`e2e/fake-api.ts`) responde exatamente com elas. Se o contrato da 001 mudar, estas fixtures e os schemas são o primeiro lugar a atualizar.

## O que o front não faz (de propósito)

Não chama `GET /health`, não cria nem apaga conversa fora do fluxo de `POST /chat`, não envia `conversationId` que não seja UUID, não repete o `POST /chat` automaticamente (qualquer nova tentativa é ação explícita da pessoa, porque o servidor pode já ter iniciado a execução) e não lê os cabeçalhos `X-Request-Id`/`X-Conversation-Id`.
