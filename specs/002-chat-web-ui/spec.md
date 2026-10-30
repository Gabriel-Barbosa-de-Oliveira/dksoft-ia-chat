# Feature Specification: Interface Web do Chat

**Feature Branch**: `feat/002-frontend-chat`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Interface web (front end) do chat de IA da DKSOFT, que consome a API do agente da spec 001. Gestores de escola e funcionários da DKSOFT conversam em linguagem natural sobre alunos, pacotes, contas a receber e contas pagas, vendo a resposta chegar aos poucos e acompanhando o que o assistente está consultando. O front é próprio e separado do front do LangGraph, para permitir mais customização. Inclui tela de acesso com a chave do chat, conversa com resposta em streaming e botão para interromper, histórico de conversas para retomar e iniciar nova, estado vazio com sugestões, resposta formatada com aviso de resultado parcial, tratamento humano de cada erro previsto pela API com código de suporte e nova tentativa, estados de loading/vazio/erro/sucesso, tema claro e escuro, acessibilidade WCAG 2.1 AA e layout responsivo. O visual segue o design system Modernist do projeto. Fora de escopo: gráficos, voz, login por usuário, multi-cliente, exclusão ou renomeação de conversas e qualquer alteração no contrato da API do agente."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar e perguntar, vendo a resposta chegar aos poucos (Priority: P1)

Um gestor de escola ou um funcionário da DKSOFT abre o chat, informa a chave de acesso uma única vez e escreve uma pergunta em linguagem natural, como "quais parcelas o aluno de matrícula 1234 tem em aberto?". Logo após enviar, vê a própria pergunta na conversa e um sinal de que o assistente está trabalhando. Em seguida acompanha os avisos do que está sendo consultado ("Buscando o aluno pela matrícula…") e o texto da resposta aparecendo em partes. Se mudar de ideia, pode interromper a resposta.

**Why this priority**: é o valor central do produto para a pessoa que usa o chat. Sem entrar e conseguir perguntar com retorno imediato, nenhuma outra parte da interface tem utilidade.

**Independent Test**: dá para testar abrindo o chat sem chave, informando a chave correta, enviando uma pergunta contra a API do agente (real ou simulada) e conferindo que a pergunta aparece de imediato, que os avisos de consulta e o texto chegam em ordem e que a resposta final fica completa na tela.

**Acceptance Scenarios**:

1. **Given** uma pessoa sem chave de acesso guardada no navegador, **When** abre o chat, **Then** vê uma tela de acesso que pede a chave e não vê conversa nem histórico.
2. **Given** a tela de acesso, **When** informa uma chave aceita pela API, **Then** entra no chat, e a chave não fica visível em nenhum lugar da tela.
3. **Given** a tela de acesso, **When** informa uma chave recusada pela API, **Then** vê uma mensagem clara de chave incorreta junto ao campo, o campo continua preenchível e nada é exibido da conversa.
4. **Given** o chat aberto e vazio, **When** a pessoa envia uma pergunta, **Then** a pergunta aparece na conversa e um indicador de atividade surge em até 1 segundo, antes mesmo de a API responder.
5. **Given** uma pergunta que exige consulta, **When** o assistente trabalha, **Then** a pessoa vê, antes do texto, cada aviso de consulta em andamento e, ao terminar, se deu certo ou falhou, sempre com texto e ícone (nunca só cor).
6. **Given** a resposta chegando, **When** novas partes de texto são recebidas, **Then** elas são acrescentadas à resposta sem apagar o que já foi lido e sem tirar a pessoa do ponto de leitura caso ela tenha rolado para cima.
7. **Given** uma resposta em andamento, **When** a pessoa aciona "Parar", **Then** a resposta é interrompida, o texto parcial permanece marcado como interrompido e a pessoa pode fazer uma nova pergunta.
8. **Given** uma resposta em andamento, **When** a pessoa tenta enviar outra pergunta na mesma conversa, **Then** o envio fica indisponível com explicação, e o texto que ela digitou é preservado.
9. **Given** uma resposta concluída, **When** a pessoa aciona "Copiar", **Then** o texto completo da resposta vai para a área de transferência e a interface confirma a ação.

---

### User Story 2 - Retomar e continuar conversas anteriores (Priority: P1)

A pessoa volta ao chat depois de algum tempo e quer continuar uma conversa anterior, por exemplo "e desses, quais já venceram?", sem repetir o contexto. Ela vê a lista de conversas, abre uma, lê o histórico e continua perguntando. Também pode começar uma conversa nova a qualquer momento. Ao recarregar a página, a conversa que estava aberta continua aberta.

**Why this priority**: o histórico e o contexto estão no pedido original do produto. Sem retomar conversas, cada visita recomeça do zero e a memória do backend não tem como ser aproveitada.

**Independent Test**: dá para testar criando duas conversas, voltando à primeira pela lista, enviando uma pergunta de acompanhamento que só faz sentido com o histórico e recarregando a página para conferir que a mesma conversa reabre.

**Acceptance Scenarios**:

1. **Given** conversas existentes, **When** a pessoa abre o histórico, **Then** vê a lista com a mais recente primeiro, cada uma identificada por data e hora da última atividade e por um trecho da primeira pergunta quando disponível.
2. **Given** uma lista maior que a primeira página, **When** a pessoa pede para ver mais, **Then** as conversas seguintes são acrescentadas sem perder a posição na lista.
3. **Given** a lista de conversas, **When** a pessoa abre uma, **Then** vê as mensagens daquela conversa em ordem, distinguindo claramente o que é dela e o que é do assistente.
4. **Given** uma conversa aberta, **When** a pessoa envia uma pergunta, **Then** a pergunta continua aquela conversa, e nada dela aparece em outra.
5. **Given** o chat aberto, **When** a pessoa aciona "Nova conversa", **Then** a conversa atual sai da tela, o estado vazio aparece e a próxima pergunta cria uma conversa nova que passa a constar no histórico.
6. **Given** uma conversa aberta, **When** a pessoa recarrega a página, **Then** a mesma conversa reabre com seu histórico.
7. **Given** um endereço que aponta para uma conversa inexistente, **When** a página abre, **Then** a pessoa vê uma mensagem clara de conversa não encontrada e a opção de iniciar uma nova.
8. **Given** nenhuma conversa existente, **When** a pessoa abre o histórico, **Then** vê um estado vazio que explica que ainda não há conversas e oferece iniciar a primeira.
9. **Given** o chat vazio, **When** a pessoa vê as sugestões de perguntas e aciona uma, **Then** o texto da sugestão preenche o campo de pergunta sem enviá-la, para que possa ajustá-lo antes.

---

### User Story 3 - Entender e se recuperar quando algo falha (Priority: P2)

Quando algo dá errado (chave recusada, limite de uso, tempo esgotado, modelo ou consultas indisponíveis, queda de conexão), a pessoa entende em linguagem simples o que aconteceu, vê o que pode fazer e não perde o que digitou. O código de suporte da requisição fica à mão para quem for pedir ajuda.

**Why this priority**: um chat que mostra erro técnico, trava em silêncio ou apaga a pergunta perde a confiança de quem usa. Depende de US1 para existir.

**Independent Test**: dá para testar simulando cada resposta de erro da API do agente e cada falha de conexão, e conferindo a mensagem exibida, a ação oferecida e a preservação do texto digitado.

**Acceptance Scenarios**:

1. **Given** a API informa que o limite de uso foi excedido, **When** a pessoa envia a pergunta, **Then** vê quanto tempo precisa esperar, e o envio é liberado de novo ao fim desse tempo, com a pergunta preservada.
2. **Given** a chave deixa de ser aceita durante o uso, **When** a API a recusa, **Then** a pessoa volta à tela de acesso, e a pergunta que ela escreveu continua disponível depois que informar uma chave válida.
3. **Given** a API recusa a origem do navegador, **When** isso ocorre, **Then** a pessoa vê uma mensagem de que este endereço não está autorizado a usar o chat e a quem recorrer, sem detalhes técnicos.
4. **Given** a resposta já começou e o fluxo termina com erro de tempo esgotado, modelo indisponível ou consultas indisponíveis, **When** o erro chega, **Then** o texto parcial permanece visível marcado como incompleto, a mensagem de erro explica o que houve e o botão "Tentar novamente" reenvia a mesma pergunta.
5. **Given** a conexão cai no meio da resposta, **When** o fluxo é interrompido sem aviso, **Then** a interface trata como erro de conexão, nunca fica esperando indefinidamente e oferece tentar novamente.
6. **Given** qualquer erro exibido, **When** a API forneceu o identificador da requisição, **Then** ele aparece como código de suporte que a pessoa pode copiar.
7. **Given** a pergunta é recusada por entrada inválida (vazia, só espaços ou acima do limite de tamanho), **When** a pessoa tenta enviar, **Then** o problema é indicado junto ao campo, o envio não é feito e o texto digitado é preservado.
8. **Given** a lista de conversas falha ao carregar, **When** a pessoa está usando o chat, **Then** o erro aparece apenas na área do histórico com opção de tentar de novo, e o restante do chat continua utilizável.
9. **Given** um erro qualquer, **When** ele é exibido, **Then** nunca mostra rastro técnico, mensagem crua da API, nem credenciais.

---

### User Story 4 - Usar com conforto em qualquer tela, tema e modo de interação (Priority: P2)

A pessoa usa o chat no computador ou no celular, com tema claro ou escuro, só com o teclado ou com leitor de tela, e tem a mesma experiência completa. A aparência segue o design system Modernist da DKSOFT.

**Why this priority**: o público usa o sistema no dia a dia de escritório e em movimento; contraste, teclado e responsividade decidem se o chat é de fato utilizável. Depende de US1 e US2 para ter o que ajustar.

**Independent Test**: dá para testar percorrendo o fluxo completo (entrar, perguntar, abrir histórico, interromper, tentar novamente) só com teclado, em largura de celular, nos dois temas, e rodando uma verificação automatizada de acessibilidade em cada tela.

**Acceptance Scenarios**:

1. **Given** a preferência de tema do sistema, **When** a pessoa abre o chat pela primeira vez, **Then** ele aparece no tema correspondente, e a escolha manual de tema feita depois é lembrada nas próximas visitas.
2. **Given** qualquer tela, **When** exibida nos temas claro e escuro, **Then** textos, controles e indicadores mantêm o contraste exigido e todos os ícones e estados continuam legíveis.
3. **Given** uma pessoa que usa só o teclado, **When** percorre o chat, **Then** alcança e aciona todos os controles em ordem lógica, com foco sempre visível.
4. **Given** uma pessoa com leitor de tela, **When** novos avisos de consulta, a conclusão da resposta ou um erro aparecem, **Then** eles são anunciados sem que ela precise procurar, e o texto da resposta não é relido a cada nova parte recebida.
5. **Given** um aparelho de tela estreita (a partir de 320 px de largura), **When** a pessoa usa o chat, **Then** não há rolagem horizontal da página, os controles têm alvo de toque confortável e o histórico se abre e se fecha sem cobrir a pergunta em digitação.
6. **Given** uma resposta com tabela larga, **When** exibida em tela estreita, **Then** só a tabela rola na horizontal, e o restante da página permanece fixo.
7. **Given** a pessoa prefere menos movimento, **When** a interface anima a chegada de texto ou a troca de telas, **Then** as animações são reduzidas ou removidas.
8. **Given** o design system Modernist, **When** a interface é comparada a ele, **Then** usa a mesma tipografia, grade visível, cantos retos, divisores fortes e rótulos alinhados à esquerda, e o acento vermelho aparece só em ação principal e destaques pequenos.
9. **Given** um erro ou aviso, **When** exibido, **Then** é distinguível por texto, ícone e forma (por exemplo, moldura e rótulo), e não apenas pela cor do acento.

---

### Edge Cases

- Pergunta com mais de 4000 caracteres: o contador mostra o excesso antes do envio e o envio fica indisponível, sem truncar em silêncio.
- A pessoa dá dois cliques rápidos em "Enviar": só uma pergunta é enviada.
- A pessoa tenta abrir outra conversa ou iniciar uma nova enquanto uma resposta está em andamento: a interface avisa que a resposta será interrompida e só prossegue se a pessoa confirmar.
- A pessoa fecha a aba durante uma resposta: nada fica "pendente" na interface ao reabrir, e a conversa mostra apenas o que o servidor gravou (uma pergunta cuja resposta não foi concluída não consta no histórico).
- Texto do assistente com marcações que pareçam código ou página (HTML, scripts, links suspeitos): é exibido como conteúdo, nunca executado.
- Palavras ou identificadores muito longos (CPF, e-mail, código de lançamento): quebram dentro do espaço disponível sem estourar o layout.
- Resposta muito longa: a pessoa consegue rolar e chegar ao campo de pergunta sem perder o ponto de leitura.
- Lista de conversas muito grande: carrega por páginas e não trava a interface.
- Navegador sem permissão de armazenamento: o chat continua funcionando durante a visita, avisando que a chave e o tema não serão lembrados.
- Resultado parcial: a resposta fica marcada de forma visível como parcial, para que ninguém confunda uma lista cortada com a lista completa.
- Dado pessoal de aluno na resposta (CPF, e-mail, telefone): é exibido normalmente, porque a pessoa pediu por aquele aluno, mas nada da conversa é guardado no navegador além da visita.
- A pessoa abre o chat em duas abas: cada aba mantém sua própria conversa aberta, sem se misturarem.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST exigir a chave de acesso do chat antes de mostrar qualquer conversa e MUST oferecer uma tela de acesso para informá-la, com mensagem de erro junto ao campo quando for recusada.
- **FR-002**: O sistema MUST guardar a chave de acesso apenas no navegador, apenas durante a sessão do navegador, MUST NOT exibi-la de volta depois de informada, nem colocá-la no endereço, em mensagens de erro ou em qualquer registro, e MUST permitir sair para informar outra chave.
- **FR-003**: O sistema MUST permitir escrever e enviar uma pergunta em linguagem natural, recusando perguntas vazias, só com espaços ou acima de 4000 caracteres, com indicação junto ao campo e contagem de caracteres perto do limite.
- **FR-004**: O sistema MUST exibir a pergunta enviada na conversa e um indicador de atividade em até 1 segundo, sem esperar a API.
- **FR-005**: O sistema MUST exibir, na ordem em que chegam, os avisos de consulta em andamento e concluídas (com sucesso ou falha), usando texto e ícone.
- **FR-006**: O sistema MUST exibir a resposta do assistente em partes à medida que chega, sem reposicionar a leitura de quem rolou para cima, e MUST indicar de forma explícita quando a resposta termina.
- **FR-007**: O sistema MUST permitir uma única resposta em andamento por conversa, MUST impedir novo envio durante ela e MUST oferecer interrompê-la, mantendo o texto parcial marcado como interrompido.
- **FR-008**: O sistema MUST apresentar o texto do assistente com formatação básica (parágrafos, listas, destaque, tabelas e trechos de código) e MUST NOT executar conteúdo vindo do texto.
- **FR-009**: O sistema MUST sinalizar de forma visível quando o resultado de uma resposta for parcial.
- **FR-010**: O sistema MUST permitir copiar o texto de uma resposta concluída.
- **FR-011**: O sistema MUST listar as conversas existentes, da mais recente para a mais antiga, em páginas, identificando cada uma por data e hora da última atividade e por um trecho da primeira pergunta quando disponível.
- **FR-012**: O sistema MUST permitir abrir uma conversa, exibir seu histórico em ordem, continuá-la com novas perguntas e iniciar uma nova conversa a qualquer momento.
- **FR-013**: O sistema MUST refletir a conversa aberta no endereço da página, de modo que recarregar ou compartilhar o endereço reabra a mesma conversa, e MUST tratar com mensagem clara um endereço de conversa inexistente.
- **FR-014**: O sistema MUST exibir, no chat sem mensagens, sugestões de perguntas sobre os assuntos que o assistente sabe responder; acionar uma sugestão MUST apenas preencher o campo.
- **FR-015**: O sistema MUST traduzir cada erro previsto pela API do agente (chave ausente ou incorreta, origem não autorizada, pergunta inválida, conversa não encontrada, limite de uso, tempo esgotado, modelo indisponível, consultas indisponíveis, falha interna) e cada falha de conexão em mensagem em linguagem simples que diga o que aconteceu e o que fazer.
- **FR-016**: O sistema MUST mostrar o código de suporte (identificador da requisição) em todo erro em que ele estiver disponível, de forma copiável, e MUST NOT mostrar rastro técnico, mensagem crua da API nem credenciais.
- **FR-017**: O sistema MUST oferecer "Tentar novamente" em erros recuperáveis, preservando o que a pessoa digitou, e, no erro de limite de uso, MUST informar o tempo de espera e liberar o reenvio ao seu término.
- **FR-018**: O sistema MUST, quando a chave deixar de ser aceita durante o uso, levar a pessoa à tela de acesso sem perder a pergunta em edição.
- **FR-019**: O sistema MUST tratar como erro explícito qualquer fim de resposta sem sinal de conclusão (queda de conexão, interrupção do servidor), nunca ficando em espera indefinida.
- **FR-020**: O sistema MUST tratar, em todo componente que carrega dados, os quatro estados (carregando com esqueleto no formato do conteúdo, vazio explicando o motivo e a próxima ação, erro com ação de nova tentativa e sucesso), isolando o erro por seção sem derrubar a página, e MUST evitar o piscar do indicador de carregamento em cargas rápidas.
- **FR-021**: O sistema MUST oferecer tema claro e escuro, iniciando pela preferência do sistema e permitindo escolha manual que persiste entre visitas, mantendo contraste adequado em ambos.
- **FR-022**: O sistema MUST atender ao nível AA das diretrizes WCAG 2.1: contraste mínimo, informação nunca só por cor, operação completa por teclado com foco visível, alvos de toque de pelo menos 44 por 44 px, campos com rótulo, botões de ícone com nome acessível, anúncio de atualizações dinâmicas relevantes e respeito à preferência por menos movimento.
- **FR-023**: O sistema MUST funcionar sem rolagem horizontal da página a partir de 320 px de largura, adaptando o histórico para telas estreitas e mantendo tabelas largas rolando apenas dentro do próprio bloco.
- **FR-024**: O sistema MUST seguir o design system Modernist do projeto (cores, tipografia, espaçamento e cantos definidos por tokens, layout de referência `Chat DKSoft.dc.html`, rótulos alinhados à esquerda, ícones Lucide) e MUST adotar uma única ação principal por tela.
- **FR-025**: O sistema MUST NOT guardar no navegador o conteúdo das conversas; o histórico vive no servidor, e o navegador guarda apenas a chave (durante a sessão), a preferência de tema e, durante a visita, o rascunho em edição.
- **FR-026**: O sistema MUST confirmar com a pessoa antes de trocar de conversa ou iniciar outra enquanto uma resposta está em andamento, informando que ela será interrompida.

### Key Entities *(include if feature involves data)*

- **Chave de acesso**: credencial única do chat, informada pela pessoa, mantida só durante a sessão do navegador e enviada a cada chamada à API do agente. Nunca é exibida de volta.
- **Conversa**: sequência ordenada de mensagens com identificador, data de criação e data da última atividade, consultada e continuada pela interface; o histórico é gravado pelo servidor.
- **Mensagem**: uma fala da pessoa ou do assistente, com papel, texto e momento.
- **Resposta em andamento**: resposta que está chegando; reúne os avisos de consulta, o texto recebido até agora e o estado (em andamento, concluída, interrompida, com erro, parcial).
- **Aviso de consulta**: indicação de que o assistente está consultando (ou consultou) um dado, com descrição legível e resultado (em andamento, sucesso ou falha).
- **Erro apresentado**: situação de falha traduzida para a pessoa, com mensagem, ação sugerida e código de suporte quando existir.
- **Preferência de tema**: escolha entre seguir o sistema, claro ou escuro, lembrada entre visitas.
- **Rascunho**: texto da pergunta em edição, preservado enquanto a pessoa resolve um erro ou informa a chave de novo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% dos envios, a pergunta aparece na conversa e o indicador de atividade surge em até 1 segundo, independentemente da velocidade da API.
- **SC-002**: Uma pessoa que já tem a chave consegue abrir o chat, entrar e enviar a primeira pergunta em menos de 30 segundos, sem instrução adicional.
- **SC-003**: Em 100% das respostas, a pessoa distingue sem ambiguidade os estados "em andamento", "concluída", "interrompida", "com erro" e "parcial".
- **SC-004**: Para cada erro previsto pela API do agente e para cada falha de conexão simulada, 100% dos casos exibem mensagem em linguagem simples com ação sugerida, e 100% dos casos em que a API forneceu um identificador de requisição exibem o código de suporte.
- **SC-005**: Em 100% dos casos de erro, o texto digitado pela pessoa continua disponível para reenvio.
- **SC-006**: Em 100% dos casos de teste, a chave de acesso não aparece na tela, no endereço, em mensagens de erro nem em qualquer armazenamento persistente do navegador, e nenhum conteúdo de conversa é guardado no navegador.
- **SC-007**: Em 100% dos casos de teste, recarregar a página com uma conversa aberta reabre a mesma conversa com todo o seu histórico.
- **SC-008**: O fluxo completo (entrar, perguntar, interromper, tentar novamente, abrir o histórico, iniciar nova conversa e trocar de tema) é concluído só com teclado, sem armadilha de foco.
- **SC-009**: Todas as telas e estados passam em uma verificação automatizada de acessibilidade nível AA, nos temas claro e escuro, sem violações críticas ou sérias.
- **SC-010**: Em larguras de 320, 768 e 1280 px, nenhuma tela apresenta rolagem horizontal da página, e todos os alvos de toque têm pelo menos 44 por 44 px.
- **SC-011**: Em 100% dos casos de teste com texto contendo marcações de página ou de script, nada é executado e o texto é exibido como conteúdo.
- **SC-012**: Uma revisão visual contra o design system Modernist não encontra uso de cor, fonte, espaçamento ou canto fora dos tokens do sistema.

## Assumptions

- Usuários: gestores de escola e funcionários da DKSOFT usam o mesmo chat; não há perfis diferentes nesta fase.
- Esta spec cobre somente a interface web (`web/`). A API do agente da spec 001 (envio da pergunta com resposta em partes, lista de conversas, histórico de uma conversa e verificação de disponibilidade) é usada como está, sem alteração de contrato.
- O acesso é feito por uma chave única, informada pela pessoa na primeira visita e mantida só enquanto a sessão do navegador durar; não há login por usuário, nem "lembrar neste dispositivo" nesta fase. O token da API DKSOFT e a chave do provedor de modelo nunca chegam à interface (constitution, princípio VI).
- A API do agente não exclui nem renomeia conversas e não devolve título nem resumo na lista; por isso a interface não oferece excluir ou renomear e identifica cada conversa por data, hora e, quando for viável obtê-lo sem mudar o contrato, um trecho da primeira pergunta. Se não for viável, a identificação por data e hora basta, e um resumo na lista fica como sugestão para uma spec do backend.
- Gráficos nas respostas e entrada por voz continuam fora de escopo, cada um com spec própria (a 001 já os separou). O campo de pergunta deve deixar espaço para um futuro controle de voz sem redesenho da tela.
- Multi-cliente, perfis, cotas e memória de longo prazo seguem fora de escopo (constitution, princípio IX).
- O assistente responde em português e as mensagens da interface são em português do Brasil; não há troca de idioma nesta fase.
- A origem em que o front é servido precisa constar na lista de origens autorizadas do backend; ajustar essa lista é configuração do servidor, não parte desta spec.
- O design system Modernist (tokens, componentes e orientações do projeto) é a fonte visual. Ele define apenas o tema claro e uma escala de espaçamento até 32 px, enquanto as diretrizes de design do repositório exigem tema escuro e escala até 64 px; a derivação do tema escuro e a ampliação da escala são decisões de projeto visual a resolver no plano, mantendo o caráter plano, de cantos retos e divisores fortes do sistema.
- O vermelho do acento é também a cor natural de erro; por isso erros e avisos devem combinar texto, ícone e forma, e o acento deve ficar reservado à ação principal e a destaques pequenos.
- Suporte de navegadores: versões atuais dos principais navegadores para computador e celular.
- A resposta do assistente é texto com formatação básica; o conteúdo do histórico vem do servidor e não é guardado localmente.
