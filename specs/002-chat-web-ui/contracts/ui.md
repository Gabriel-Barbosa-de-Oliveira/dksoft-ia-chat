# Contrato de interface: telas, estados, acessibilidade e textos

**Feature**: [spec.md](../spec.md) | **Pesquisa**: [research.md](../research.md) | **Dados**: [data-model.md](../data-model.md)

Descreve o que a pessoa vê e o que as tecnologias assistivas recebem. É o roteiro de teste do E2E e da revisão visual contra o design system Modernist.

## Rotas

| Rota | Tela | Observação |
|------|------|-----------|
| `/` | Conversa nova (estado vazio) ou tela de acesso se não houver chave | |
| `/c/:conversationId` | Conversa existente | Id não UUID ou inexistente → "Conversa não encontrada" |
| qualquer outra | Redireciona para `/` | |

Sem chave válida, qualquer rota mostra a tela de acesso; depois de entrar, a pessoa continua na rota que pediu.

## Telas e regiões

### Tela de acesso

- `main` com `h1` "Acesso ao chat", texto curto explicando que a chave é fornecida pela DKSOFT, campo "Chave de acesso" (`type="password"`, rótulo associado, erro inline com `aria-describedby`) e o botão principal "Entrar". Nenhum histórico nem conversa é renderizado atrás dela.
- Estados: ocioso, validando (botão com `aria-busy` e rótulo "Verificando…", campo preservado), erro inline (chave incorreta; endereço não autorizado; sem conexão), sucesso (entra no chat).

### Chat

Estrutura de pontos de referência: link "Pular para a conversa" → `header.nav` (marca, botão "Histórico" em tela estreita, alternância de tema, "Sair") → `aside` (histórico) → `main` (conversa) → compositor no pé de `main`.

- `h1` único da tela: "Assistente DKSOFT" (visível na barra de contexto de `main`). Títulos internos seguem `h2`/`h3` sem pular nível.
- **Conversa** (`main`): lista de turnos. Cada turno é um bloco separado por régua de 2 px, com rótulo "Você" e rótulo "Assistente" (estilo `h6` do DS, alinhado à esquerda), sem balões.
- **Compositor**: `textarea` rotulado "Pergunta" (cresce até 6 linhas), contador de caracteres a partir de 90 % do limite, botão principal "Enviar" (ícone `send` à direita do rótulo, rótulo alinhado à esquerda como manda o DS) e botão secundário "Parar" visível só durante a resposta. Slot reservado ao lado para um controle de voz futuro. `Enter` envia; `Shift+Enter` quebra linha; o atalho está descrito em texto de apoio ligado por `aria-describedby`.
- **Histórico** (`aside`, "Conversas"): botão "Nova conversa" no topo, lista com a conversa aberta marcada por `aria-current="true"`, botão "Carregar mais" ao fim. Em tela estreita é uma folha `<dialog>` aberta pelo botão "Histórico".

## Estados por componente

Toda parte que carrega dados trata os quatro estados (FR-020). O skeleton só aparece se a carga passar de 300 ms.

| Componente | Carregando | Vazio | Erro | Sucesso |
|------------|-----------|-------|------|---------|
| Lista de conversas | 5 linhas-esqueleto no formato do item | "Nenhuma conversa ainda. Faça sua primeira pergunta." + botão "Nova conversa" | `StatusNotice` no painel + "Tentar novamente" (o chat segue utilizável) | Lista com data/hora e prévia |
| Prévia de um item | Data e hora no lugar | n/a | Data e hora no lugar (falha silenciosa e isolada) | Trecho da primeira pergunta |
| Histórico de uma conversa | Esqueleto de dois turnos | Conversa sem mensagens: estado vazio do chat | `StatusNotice` na área da conversa + "Tentar novamente" | Turnos em ordem |
| Conversa não encontrada | n/a | n/a | `StatusNotice` "Conversa não encontrada" + "Iniciar nova conversa" | n/a |
| Resposta em andamento | Indicador "Consultando…" imediato e avisos de consulta | n/a | `StatusNotice` no turno, texto parcial mantido e marcado | Texto completo, "Copiar", aviso de parcial se houver |
| Tela de acesso | Botão "Verificando…" | n/a | Erro inline junto ao campo | Entra no chat |

## Estado vazio do chat (sem mensagens)

`h2` "O que você quer saber?" e um parágrafo curto sobre o que o assistente consulta (alunos, pacotes, contas recebidas e pagas), seguido de **5 sugestões** como botões em `.card` clicáveis (cada um com nome acessível igual ao texto). Acionar uma sugestão **preenche o campo e foca nele, sem enviar** (FR-014). Textos (em `lib/suggestions.ts`, sem datas fixas):

1. "Quais parcelas em aberto o aluno de matrícula 1234 tem?"
2. "Quanto recebemos na última semana?"
3. "Quais contas pagamos nos últimos 15 dias?"
4. "Quais pacotes estão disponíveis?"
5. "O que você consegue fazer?"

## Turno do assistente: elementos

- **Avisos de consulta**: lista com um item por consulta, ícone + texto: em andamento (`loader-circle`, giro desligado com movimento reduzido), concluída (`check`), falhou (`x`). O texto é o `label` do servidor.
- **Texto**: Markdown renderizado (item 7 da pesquisa); tabelas largas rolam dentro do próprio bloco, com nome acessível e foco por teclado.
- **Parcial**: `StatusNotice` variante aviso com `triangle-alert` e "Resultado parcial: a lista está incompleta. Refine a pergunta para ver o restante." (FR-009).
- **Interrompida**: variante com `octagon-x`, "Resposta interrompida. Ela não será guardada no histórico." (R7 da pesquisa).
- **Ações do turno concluído**: "Copiar" (vira "Copiado" por 2 s) e, se `done.model` existir, o nome do modelo em `figcaption` discreto (contraste de texto secundário).
- **Erro**: `StatusNotice` com título, mensagem, botão "Tentar novamente" quando a ação for `retry`, e "Código de suporte: <id>" com botão "Copiar código".

## Mensagens de erro (pt-BR)

| `kind` | Título | Mensagem | Ação |
|--------|--------|----------|------|
| `unauthorized` (tela de acesso) | Chave incorreta | A chave informada não foi aceita. Confira e tente de novo. | Refazer o campo |
| `unauthorized` (durante o uso) | Sua sessão expirou | Informe a chave de acesso de novo para continuar. A sua pergunta foi mantida. | Ir à tela de acesso |
| `origin_not_allowed` | Endereço não autorizado | Este endereço não tem permissão para usar o chat. Fale com a equipe da DKSOFT e informe o código de suporte. | Nenhuma |
| `conversation_not_found` | Conversa não encontrada | Esta conversa não existe mais ou o endereço está incorreto. | Iniciar nova conversa |
| `rate_limited` | Muitas perguntas em pouco tempo | Aguarde {n} s para enviar de novo. A sua pergunta foi mantida. | Aguardar; libera no fim da contagem |
| `invalid_body` | Pergunta não enviada | O texto não pôde ser enviado. Revise a pergunta e tente de novo. | Editar |
| `timeout` | A resposta demorou demais | A pergunta passou do tempo máximo. Tente de novo ou simplifique o pedido. | Tentar novamente |
| `model_unavailable` | Assistente indisponível | O assistente de IA está indisponível agora. Tente novamente em instantes. | Tentar novamente |
| `tools_unavailable` | Não foi possível consultar os dados | Não consegui consultar os dados da escola agora. Tente novamente em instantes. | Tentar novamente |
| `server_error` | Algo deu errado | Ocorreu um erro inesperado do nosso lado. Tente novamente. | Tentar novamente |
| `network` | Sem conexão | Não foi possível falar com o servidor. Verifique a sua internet e tente de novo. | Tentar novamente |
| `connection_lost` | Conexão interrompida | A conexão caiu antes do fim da resposta. O texto recebido até aqui está acima. | Tentar novamente |
| `client_timeout` | A resposta está demorando demais | Não recebi o fim da resposta a tempo. Tente de novo. | Tentar novamente |
| `unexpected_response` | Resposta inesperada | O servidor respondeu de um jeito que a interface não entende. Tente de novo; se persistir, informe o código de suporte. | Tentar novamente |

Nenhuma mensagem contém rastro técnico, texto cru da API, chave ou dado de aluno.

## Anúncios para leitor de tela (região `aria-live="polite"`)

| Evento | Texto anunciado |
|--------|-----------------|
| Início de consulta | O `label` da consulta (por exemplo, "Buscando o aluno pela matrícula…") |
| Resposta concluída | "Resposta concluída." (e "Resultado parcial." se aplicável) |
| Resposta interrompida | "Resposta interrompida." |
| Texto copiado | "Resposta copiada." |
| Erro (`role="alert"`, não na região polida) | Título e mensagem do erro |
| Conversa aberta | "Conversa aberta com N mensagens." |
| Contagem de espera | A cada 15 s e ao zerar: "Você já pode enviar de novo." |

O texto da resposta em si **não** é anunciado token a token.

## Mapa de teclado

| Contexto | Teclas | Efeito |
|----------|--------|--------|
| Campo de pergunta | `Enter` / `Shift+Enter` | Envia / nova linha |
| Durante a resposta | `Esc` com foco no compositor | Aciona "Parar" |
| Folha de histórico e confirmação | `Esc` | Fecha (foco volta ao botão que abriu) |
| Lista de conversas | `Tab` entre itens, `Enter`/`Space` abre | Cada item é um botão/link nativo |
| Qualquer tela | `Tab` / `Shift+Tab` | Ordem lógica: pular link → barra → histórico → conversa → compositor |

Foco visível em todo elemento interativo (`:focus-visible` do DS, 2 px de acento). Nenhuma armadilha de foco fora das folhas modais.

## Confirmação ao trocar de conversa durante uma resposta (FR-026)

`<dialog>` modal: título "Interromper a resposta?", texto "Ao trocar de conversa a resposta em andamento será interrompida e não ficará no histórico.", botões "Continuar aqui" (secundário, foco inicial) e "Interromper e trocar" (principal).

## Responsivo

| Largura | Layout |
|---------|--------|
| 20 rem a < 48 rem | Uma coluna; histórico em folha; compositor fixo no pé; "Enviar" e "Parar" com 44 px de altura e rótulo visível |
| 48 rem a < 64 rem | Uma coluna com mais respiro; histórico ainda em folha |
| ≥ 64 rem | Duas colunas (histórico de 20 a 24 rem à esquerda), conversa à direita, régua de 2 px entre elas |

Sem rolagem horizontal da página em nenhuma largura; só tabelas largas rolam, dentro do próprio bloco.

## Revisão visual contra o Modernist (checklist de aceite)

- Cores, fontes, espaços e cantos vindos só de tokens; raio 0; réguas de 2 px entre seções e turnos.
- Rótulos e títulos alinhados à esquerda, inclusive dentro dos botões largos.
- Acento vermelho só no botão principal, no foco e em destaques pequenos; erro e aviso combinam moldura, ícone, rótulo e texto.
- Uma ação principal por tela: "Entrar" na tela de acesso; "Enviar" no chat.
- Ícones Lucide, 16 a 20 px, `aria-hidden` quando decorativos e `aria-label` em botões só de ícone.
- Nenhuma imagem fotográfica nesta spec (portanto, nada a passar por `.grayscale`).
