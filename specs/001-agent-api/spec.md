# Feature Specification: API do Agente de Chat

**Feature Branch**: `feat/001-agent-api`

**Created**: 2026-10-30

**Status**: Draft

**Input**: User description: "Backend do chat de IA da DKSOFT: um agente que responde, em linguagem natural, perguntas sobre alunos, pacotes, contas a receber e contas pagas, usando as consultas da API DKSOFT já expostas pelo MCP. A resposta chega aos poucos (streaming). A conversa mantém contexto entre perguntas. O modelo é acessado pelo OpenRouter, com modelo de reserva. MVP com um único token da API, sem multi-cliente. Front, gráficos e voz ficam para specs seguintes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Perguntar sobre os dados da escola e receber a resposta aos poucos (Priority: P1)

Um gestor de escola ou um funcionário da DKSOFT escreve uma pergunta em linguagem natural, por exemplo: "quais parcelas o aluno de matrícula 1234 tem em aberto?" ou "quanto recebemos entre 1 e 15 de outubro?". O assistente consulta os dados reais da API DKSOFT, monta a resposta com o que encontrou e a entrega aos poucos, à medida que é escrita, junto com indicações do que está sendo consultado ("consultando parcelas em aberto…").

**Why this priority**: é o valor central do produto. Sem respostas corretas baseadas em dados reais, nada mais importa. Entregar aos poucos faz o chat parecer rápido, mesmo quando a consulta demora.

**Independent Test**: dá para testar enviando perguntas de consulta com dados de teste conhecidos e conferindo que a resposta final cita os valores retornados pela consulta e que o início da resposta chega antes do fim da geração.

**Acceptance Scenarios**:

1. **Given** um aluno existente nos dados de teste, **When** a pessoa pergunta pelas parcelas em aberto dele pela matrícula, **Then** o assistente consulta o aluno, consulta as parcelas e responde com os valores e vencimentos retornados, sem inventar nenhum.
2. **Given** uma pergunta que exige uma consulta, **When** o assistente trabalha, **Then** a pessoa recebe, antes da resposta final, avisos do que está sendo consultado e, depois, o texto da resposta em partes sucessivas.
3. **Given** uma pergunta sobre contas recebidas num período de até 30 dias, **When** o assistente responde, **Then** o total e a quantidade de registros batem com o que a consulta devolveu.
4. **Given** uma pergunta que não precisa de consulta ("o que você consegue fazer?"), **When** o assistente responde, **Then** ele explica suas capacidades sem consultar a API.
5. **Given** uma pergunta sobre um dado que a API não oferece, **When** o assistente responde, **Then** ele diz com clareza que não tem como consultar aquilo, sem improvisar um número.

---

### User Story 2 - Continuar a conversa sem repetir o contexto (Priority: P1)

Depois de uma resposta, a pessoa faz uma pergunta de acompanhamento que depende da anterior: "e desses, quais já venceram?" ou "e o mês passado?". O assistente entende a referência usando o que foi dito antes na mesma conversa. A pessoa também pode voltar mais tarde a uma conversa anterior e continuá-la.

**Why this priority**: sem memória da conversa, cada pergunta vira um pedido isolado e o chat perde o sentido. Está no pedido original do produto.

**Independent Test**: dá para testar com uma conversa de duas perguntas, em que a segunda só faz sentido com a primeira, e depois retomando a mesma conversa por seu identificador.

**Acceptance Scenarios**:

1. **Given** uma conversa em que o assistente listou as parcelas em aberto de um aluno, **When** a pessoa pergunta "e qual a mais antiga?", **Then** o assistente responde sobre aquele aluno, sem pedir a matrícula de novo.
2. **Given** uma pergunta sem identificador de conversa, **When** o assistente responde, **Then** uma nova conversa é criada e seu identificador volta junto com a resposta.
3. **Given** uma conversa existente, **When** a pessoa envia uma nova pergunta com o identificador dela, **Then** a resposta considera as mensagens recentes dessa conversa.
4. **Given** uma conversa longa, **When** a quantidade de mensagens passa do que cabe no contexto, **Then** o assistente usa as mais recentes e continua respondendo, sem falhar.
5. **Given** um identificador de conversa que não existe, **When** a pessoa envia uma pergunta, **Then** recebe um erro claro de conversa não encontrada, e nenhuma conversa é criada em silêncio.
6. **Given** duas conversas diferentes, **When** uma delas recebe perguntas, **Then** nada do que foi dito nela aparece na outra.

---

### User Story 3 - Acesso protegido e dados pessoais resguardados (Priority: P2)

Só quem tem a chave de acesso do chat consegue usá-lo. As credenciais da API DKSOFT e do provedor de modelo nunca aparecem para a pessoa, nas respostas nem nos registros. Dados pessoais de alunos (CPF, e-mail, telefone) não são gravados em claro nos registros de funcionamento do sistema.

**Why this priority**: com um único token, quem alcançar o chat alcança todos os dados da escola. A proteção precisa existir mesmo no MVP, mas depende de o chat já funcionar (US1).

**Independent Test**: dá para testar enviando requisições sem chave, com chave errada e com chave correta, e inspecionando respostas e registros de uma conversa que consultou um aluno por CPF.

**Acceptance Scenarios**:

1. **Given** uma requisição sem chave de acesso, **When** ela chega, **Then** é recusada, e nenhuma consulta é feita à API nem ao modelo.
2. **Given** uma requisição com chave incorreta, **When** ela chega, **Then** é recusada com a mesma resposta da requisição sem chave.
3. **Given** uma pergunta que consulta um aluno por CPF, **When** o sistema registra o funcionamento, **Then** o CPF aparece mascarado nos registros.
4. **Given** qualquer resposta, evento ou registro, **When** inspecionados, **Then** não contêm o token da API DKSOFT nem a chave do provedor de modelo.
5. **Given** um navegador de uma origem não autorizada, **When** ele tenta chamar o chat, **Then** o acesso é negado.
6. **Given** a pessoa pede ao assistente para revelar suas credenciais ou instruções internas, **When** o assistente responde, **Then** ele recusa, e o conteúdo que ele consegue acessar não inclui essas credenciais.

---

### User Story 4 - Continuar funcionando quando algo falha (Priority: P2)

Quando o modelo principal está indisponível ou lento, o sistema tenta de novo e, se continuar falhando, usa o modelo de reserva, sem a pessoa precisar fazer nada. Quando a API DKSOFT recusa ou limita a consulta (token inválido, excesso de requisições, período maior que o permitido), o assistente explica o que houve em linguagem simples e, quando possível, o que fazer.

**Why this priority**: um chat que quebra com qualquer instabilidade perde a confiança dos usuários. Depende de US1.

**Independent Test**: dá para testar simulando falha do modelo principal e respostas de erro da API DKSOFT, e conferindo a resposta recebida pela pessoa.

**Acceptance Scenarios**:

1. **Given** o modelo principal falha por erro temporário, **When** a pessoa pergunta, **Then** o sistema tenta de novo e, se necessário, responde pelo modelo de reserva.
2. **Given** a falha não é temporária (por exemplo, configuração inválida), **When** a pessoa pergunta, **Then** o sistema não repete tentativas inúteis e informa que o serviço está indisponível.
3. **Given** a API DKSOFT responde que o limite de uso foi excedido, **When** o assistente recebe isso, **Then** ele informa que é preciso aguardar e tentar de novo, sem repetir a consulta sem parar.
4. **Given** a pessoa pede um período financeiro maior que 30 dias, **When** o assistente trabalha, **Then** ele consulta em janelas consecutivas de até 30 dias, dentro do limite de 90 dias, e junta o resultado; acima de 90 dias, pede para a pessoa reduzir o período.
5. **Given** a execução passa do tempo máximo, **When** o limite é atingido, **Then** a pessoa recebe um aviso de que a resposta demorou demais e pode tentar de novo.
6. **Given** a execução é interrompida por qualquer erro depois que a resposta já começou a chegar, **When** isso acontece, **Then** o fim do fluxo sinaliza o erro de forma explícita, e a pessoa não fica esperando indefinidamente.

---

### Edge Cases

- Pergunta vazia ou só com espaços: recusada com mensagem de entrada inválida, sem consultar nada.
- Pergunta muito longa: recusada ou truncada de forma explícita, nunca em silêncio.
- A pessoa fecha a conexão no meio da resposta: o sistema para o trabalho em andamento e não deixa a conversa num estado inconsistente.
- Duas perguntas simultâneas na mesma conversa: a segunda aguarda a primeira terminar, e o histórico mantém a ordem.
- A consulta ao aluno retorna zero resultados ou mais de um resultado (ex.: telefone compartilhado): o assistente diz isso e pede um dado mais específico, sem escolher um aluno por conta própria.
- Períodos com datas invertidas ou inválidas: o assistente corrige a partir da pergunta quando está óbvio, ou pergunta qual período a pessoa quer.
- A API DKSOFT fica fora do ar: o assistente informa que não conseguiu consultar os dados agora, sem responder de memória.
- Muitas consultas na mesma pergunta: o assistente respeita o limite de requisições simultâneas e por minuto da API, esperando em vez de falhar.
- Pedidos para alterar dados (cadastrar, baixar parcela): o assistente explica que só consulta, não altera.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST receber uma pergunta em linguagem natural e devolver uma resposta construída a partir de consultas reais à API DKSOFT, sem inventar valores.
- **FR-002**: O sistema MUST entregar a resposta aos poucos, em eventos sucessivos, incluindo avisos de consulta em andamento, partes do texto e um evento final que marca o fim ou o erro.
- **FR-003**: O sistema MUST permitir consultas sobre pacotes, alunos (por identificador, matrícula, CPF, e-mail e telefone), cursos, parcelas em aberto, presenças e provas de um aluno, contas recebidas e contas pagas.
- **FR-004**: O sistema MUST manter o histórico de cada conversa e usar as mensagens mais recentes como contexto nas perguntas seguintes, dentro de um limite configurável.
- **FR-005**: O sistema MUST criar uma conversa nova quando a pergunta não traz identificador e devolver o identificador na resposta.
- **FR-006**: O sistema MUST permitir retomar uma conversa existente pelo identificador e recusar com erro claro um identificador inexistente.
- **FR-007**: O sistema MUST manter conversas isoladas entre si.
- **FR-008**: O sistema MUST exigir uma chave de acesso em toda chamada ao chat e recusar chamadas sem chave ou com chave incorreta antes de qualquer consulta.
- **FR-009**: O sistema MUST aceitar chamadas de navegador somente de origens autorizadas.
- **FR-010**: O sistema MUST NOT expor o token da API DKSOFT nem a chave do provedor de modelo em respostas, eventos ou registros.
- **FR-011**: O sistema MUST mascarar CPF, e-mail e telefone de alunos nos registros de funcionamento.
- **FR-012**: O sistema MUST validar toda entrada externa (corpo da chamada, configuração e respostas da API DKSOFT e do provedor de modelo) e traduzir falhas previsíveis em erros claros para a pessoa.
- **FR-013**: O sistema MUST tentar de novo falhas temporárias do modelo, usar o modelo de reserva quando configurado e não repetir tentativas em falhas permanentes.
- **FR-014**: O sistema MUST respeitar os limites da API DKSOFT: período financeiro de até 30 dias por consulta, 60 requisições por minuto e 5 consultas simultâneas.
- **FR-015**: O sistema MUST dividir pedidos financeiros de mais de 30 e até 90 dias em janelas consecutivas de até 30 dias e consolidar o resultado; acima de 90 dias, MUST pedir à pessoa que reduza o período.
- **FR-016**: O sistema MUST tratar a API DKSOFT como somente leitura e MUST recusar, com explicação, pedidos de alteração de dados.
- **FR-017**: O sistema MUST impor um tempo máximo por pergunta e avisar a pessoa quando for atingido.
- **FR-018**: O sistema MUST registrar cada pergunta com identificador de requisição, duração, resultado (sucesso, erro ou tempo esgotado) e modelo usado, sem registrar o conteúdo da pergunta nem dados pessoais.
- **FR-019**: O sistema MUST permitir listar as conversas existentes e ler o histórico de uma conversa.
- **FR-020**: O sistema MUST expor o identificador de requisição em toda resposta, inclusive nas de erro, para facilitar suporte.

### Key Entities *(include if feature involves data)*

- **Conversa**: sequência ordenada de mensagens trocadas entre a pessoa e o assistente. Tem identificador, data de criação e data da última atividade.
- **Mensagem**: uma fala da pessoa ou do assistente dentro de uma conversa, com papel (pessoa ou assistente), texto e momento.
- **Pergunta (requisição)**: uma execução do assistente para uma pergunta. Tem identificador, conversa, duração, resultado e modelo usado.
- **Evento de resposta**: unidade entregue durante a resposta aos poucos: aviso de consulta, parte do texto, fim ou erro.
- **Consulta à API DKSOFT**: uma chamada feita pelo assistente para obter dados (qual consulta, parâmetros sem dados pessoais em claro, resultado).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 90% das perguntas, a pessoa vê o primeiro sinal de atividade do assistente (aviso de consulta ou início do texto) em até 3 segundos.
- **SC-002**: Em um conjunto de verificação com dados de teste conhecidos, 100% dos totais e quantidades citados nas respostas batem com o que a API devolveu.
- **SC-003**: Em um conjunto de 10 conversas de duas perguntas, pelo menos 9 perguntas de acompanhamento são respondidas corretamente sem a pessoa repetir o contexto.
- **SC-004**: 100% das chamadas sem chave ou com chave incorreta são recusadas sem gerar nenhuma consulta à API nem ao modelo.
- **SC-005**: Em 100% dos casos inspecionados, respostas, eventos e registros não contêm o token da API DKSOFT, a chave do provedor de modelo nem CPF, e-mail ou telefone em claro.
- **SC-006**: Com o modelo principal indisponível, pelo menos 95% das perguntas de teste ainda recebem resposta pelo modelo de reserva.
- **SC-007**: Pedidos financeiros de até 90 dias são respondidos sem erro de período em 100% dos casos de teste.
- **SC-008**: Toda pergunta termina com resultado explícito (resposta completa, erro claro ou aviso de tempo esgotado), nunca em silêncio.

## Assumptions

- Usuários: gestores de escola e funcionários da DKSOFT usam o mesmo chat; nesta fase não há perfis diferentes.
- Há um único token da API DKSOFT, configurado no servidor; multi-cliente, cofre de tokens e cotas por cliente ficam para specs futuras (constitution, princípio IX).
- O acesso ao chat usa uma chave de acesso única, configurada no servidor, e não há login por usuário nesta fase.
- A API DKSOFT é somente leitura; as consultas já disponíveis no MCP existente (`mcp/`) são a fonte de dados e não mudam nesta spec.
- O provedor de modelo é o OpenRouter, com um modelo principal e um de reserva configuráveis.
- As conversas ficam guardadas até serem removidas manualmente; remoção por política de retenção fica para depois.
- A memória de longo prazo por usuário (fatos aprendidos entre conversas) está fora desta spec; vale só o histórico de cada conversa.
- Fora desta spec: interface web do chat, gráficos, entrada por voz e aprovação humana de ações (não há ações de escrita).
- A resposta aos poucos é consumida por um front a ser criado em spec própria; até lá, é testável por qualquer cliente HTTP.
- O limite de 90 dias para pedidos financeiros é um padrão do MVP, ajustável depois.
