# Feature Specification: Exportação de Arquivos e Gráficos no Chat

**Feature Branch**: `feat/004-exportacao-graficos`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "Evoluir o chat de IA da DKSOFT (MVP já validado) com duas capacidades. (1) Exportação de arquivos: quando o usuário solicitar na conversa (ou clicar em um botão "Exportar"), o chat gera PDF, Excel (.xlsx) ou Word (.docx) com os dados consultados na conversa e entrega um link de download temporário no próprio chat. Os dados do arquivo vêm do resultado já consultado na sessão (referenciado por identificador), nunca redigitados pelo modelo. Links expiram em pouco tempo, são ligados à sessão e há limite de linhas por arquivo. (2) Gráficos na conversa: quando pertinente (comparações, séries temporais, distribuições) ou quando solicitado, o chat exibe gráficos além do texto, a partir de uma especificação estruturada validada (tipo, título, eixo x, séries); a mesma especificação deve poder ser incluída nos arquivos exportados (PDF, Word e Excel). Usuários: clientes finais, funcionários da DKSOFT e gestores de escolas. Respeitar a constitution: um único token (MVP sem multi-tenant), API DKSOFT somente leitura, dados pessoais (CPF, e-mail, telefone) tratados com cuidado nos arquivos e logs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pedir um arquivo na conversa e baixá-lo (Priority: P1)

Um gestor de escola consulta, por exemplo, as contas recebidas de outubro. Depois de ver a resposta, escreve "me manda isso em Excel". O assistente confirma o que vai exportar, gera o arquivo e mostra no próprio chat um cartão de arquivo com nome, formato, tamanho e prazo de validade do link. A pessoa baixa o arquivo, abre no computador e encontra exatamente os registros que o assistente consultou, com colunas legíveis, valores formatados em português do Brasil e totais corretos. O mesmo vale para PDF e Word.

**Why this priority**: é o pedido central da evolução. Gestores precisam levar os números para fora do chat (reuniões, prestação de contas, planilhas próprias); sem o arquivo, a consulta morre na tela.

**Independent Test**: dá para testar consultando contas recebidas de um período curto, pedindo cada um dos três formatos em perguntas separadas e conferindo que cada arquivo baixa, abre e traz os mesmos registros e totais mostrados na conversa.

**Acceptance Scenarios**:

1. **Given** uma conversa em que o assistente já consultou contas recebidas, **When** a pessoa pede "exporta em Excel", **Then** o assistente gera o arquivo e o chat mostra um cartão com nome, formato, tamanho, prazo de validade e a ação de baixar.
2. **Given** a mesma conversa, **When** a pessoa pede o resultado em PDF e depois em Word, **Then** recebe um arquivo de cada formato, todos com os mesmos registros e totais.
3. **Given** um arquivo gerado, **When** a pessoa o abre, **Then** vê título, data e hora de geração, período e filtros usados, colunas com nomes legíveis, datas no formato dia/mês/ano e valores em reais, e os totais conferem com os da conversa.
4. **Given** um arquivo Excel gerado, **When** a pessoa ordena ou soma uma coluna de valores ou de datas, **Then** a planilha trata esses campos como números e datas, não como texto.
5. **Given** uma conversa em que nada foi consultado ainda, **When** a pessoa pede um arquivo, **Then** o assistente explica que ainda não há dados para exportar e oferece fazer a consulta primeiro, sem gerar arquivo vazio nem inventado.
6. **Given** uma conversa com mais de um resultado consultado, **When** a pessoa pede um arquivo sem dizer qual, **Then** o assistente diz qual resultado vai exportar (o mais recente) ou pergunta, antes de gerar.
7. **Given** um pedido de arquivo, **When** o assistente responde, **Then** nenhum valor do arquivo foi digitado ou refeito pelo modelo: todos vêm dos registros já consultados.

---

### User Story 2 - Ver gráficos na conversa (Priority: P1)

Ao perguntar "como foram os recebimentos por semana em outubro?" ou "qual a distribuição das contas pagas por centro de custo?", a pessoa vê, junto da resposta em texto, um gráfico claro (barras, linhas ou pizza) com título, eixos e legenda. Quando a pergunta não pede comparação, evolução ou distribuição, o assistente responde só com texto. A pessoa também pode pedir explicitamente: "mostra isso em gráfico".

**Why this priority**: gráficos transformam listas longas em leitura rápida e já foram decididos como parte do produto. Têm o mesmo peso da exportação, pois alimentam os arquivos da US4.

**Independent Test**: dá para testar com uma consulta de série temporal, uma de comparação entre categorias e uma de distribuição, conferindo que cada uma traz o tipo de gráfico adequado, que os valores batem com os registros e que uma pergunta simples ("quantos alunos há no pacote X?") não gera gráfico.

**Acceptance Scenarios**:

1. **Given** uma pergunta sobre evolução ao longo do tempo, **When** o assistente responde, **Then** o texto vem acompanhado de um gráfico de linhas ou barras com título, rótulos de eixo e legenda quando houver mais de uma série.
2. **Given** uma pergunta que compara categorias ou mostra a distribuição de um total, **When** o assistente responde, **Then** vê um gráfico de barras ou de pizza adequado, com os valores corretos.
3. **Given** uma pergunta cuja resposta é um único valor ou uma lista curta, **When** o assistente responde, **Then** a resposta é apenas texto, sem gráfico.
4. **Given** qualquer resposta, **When** a pessoa pede "mostra em gráfico", **Then** o assistente gera o gráfico se os dados permitirem e, se não permitirem, explica o motivo em uma frase e mantém a resposta em texto.
5. **Given** um gráfico exibido, **When** a pessoa usa leitor de tela ou só o teclado, **Then** encontra título, resumo em texto do que o gráfico mostra e acesso aos mesmos dados em forma de tabela.
6. **Given** um gráfico exibido, **When** a pessoa troca entre tema claro e escuro ou abre o chat no celular, **Then** o gráfico continua legível, sem depender só de cor para distinguir séries.
7. **Given** uma conversa antiga com gráficos, **When** a pessoa a reabre pelo histórico, **Then** os gráficos reaparecem junto das respostas em que foram mostrados.
8. **Given** uma falha ao montar o gráfico, **When** a resposta chega, **Then** o texto continua completo e legível, sem área quebrada nem mensagem técnica.

---

### User Story 3 - Exportar com um clique, sem conversar (Priority: P2)

Perto de cada resposta que contém dados exportáveis, a pessoa vê um controle "Exportar" com os três formatos. Ao escolher um, o arquivo é gerado e o cartão de download aparece na conversa, sem que a pessoa precise escrever o pedido e sem nova interpretação do assistente.

**Why this priority**: torna a exportação descobrível e previsível para quem não sabe que pode pedir em texto, e evita custo e demora de uma nova passagem pelo modelo. Depende da base entregue na US1.

**Independent Test**: dá para testar abrindo uma resposta com dados, acionando "Exportar" em cada formato e conferindo que o arquivo é igual ao obtido por pedido escrito, e que respostas sem dados não mostram o controle.

**Acceptance Scenarios**:

1. **Given** uma resposta com dados exportáveis, **When** a pessoa vê a resposta, **Then** há um controle "Exportar" com PDF, Excel e Word.
2. **Given** o controle, **When** a pessoa escolhe um formato, **Then** o arquivo é gerado e o cartão de download aparece na conversa, com indicação de progresso enquanto isso acontece.
3. **Given** uma resposta sem dados exportáveis (explicação, recusa, erro), **When** a pessoa a vê, **Then** o controle não aparece.
4. **Given** o mesmo resultado, **When** a pessoa exporta pelo controle e depois pede por texto, **Then** os dois arquivos têm o mesmo conteúdo.
5. **Given** o controle em uso, **When** a pessoa navega só pelo teclado ou com leitor de tela, **Then** consegue escolher o formato e baixar o arquivo, e o resultado é anunciado.

---

### User Story 4 - Levar os gráficos para dentro dos arquivos (Priority: P2)

A pessoa vê um gráfico na conversa e pede "exporta em PDF com o gráfico". O arquivo traz o mesmo gráfico, com o mesmo título e as mesmas séries, junto da tabela de dados. O mesmo vale para Word e Excel.

**Why this priority**: fecha o ciclo para quem monta relatórios. Depende das US1 e US2, por isso vem depois delas.

**Independent Test**: dá para testar gerando um gráfico, exportando nos três formatos com o pedido "com gráfico" e conferindo que o gráfico do arquivo mostra os mesmos valores do exibido na conversa.

**Acceptance Scenarios**:

1. **Given** um gráfico exibido na conversa, **When** a pessoa pede o arquivo "com o gráfico" em PDF ou Word, **Then** o documento traz o gráfico legível, com título, legenda e valores iguais aos da conversa, acompanhado da tabela de dados.
2. **Given** o mesmo pedido em Excel, **When** a pessoa abre a planilha, **Then** encontra o gráfico junto da tabela de dados, com os mesmos valores.
3. **Given** um resultado que também tem gráfico, **When** a pessoa pede o arquivo sem mencionar gráfico, **Then** o arquivo traz apenas os dados, e o assistente informa que pode incluir o gráfico se a pessoa quiser.
4. **Given** um gráfico que não pôde ser montado, **When** a pessoa pede o arquivo "com gráfico", **Then** o assistente avisa que o gráfico não está disponível e gera o arquivo só com os dados, se a pessoa quiser.

---

### User Story 5 - Entender limites, expiração e falhas (Priority: P3)

Quando algo impede o arquivo ou o gráfico (resultado grande demais, link vencido, tempo esgotado, falha ao gerar), a pessoa entende em linguagem simples o que aconteceu, o que pode fazer em seguida e qual é o código de suporte, sem perder a conversa.

**Why this priority**: não gera valor sozinho, mas evita frustração e chamados quando os limites aparecem.

**Independent Test**: dá para testar com um resultado acima do limite de linhas, um link vencido e uma falha simulada de geração, conferindo a mensagem, a ação sugerida e o código de suporte em cada caso.

**Acceptance Scenarios**:

1. **Given** um resultado com mais linhas que o limite por arquivo, **When** a pessoa pede o arquivo, **Then** o assistente informa o limite e o tamanho do resultado, sugere reduzir o período ou aplicar filtros e não entrega arquivo cortado em silêncio.
2. **Given** um link de download vencido, **When** a pessoa tenta baixar, **Then** vê que o link expirou e pode gerar o arquivo de novo com uma ação direta, sem repetir a consulta quando os dados ainda estiverem disponíveis.
3. **Given** uma falha ao gerar o arquivo ou tempo esgotado, **When** o erro ocorre, **Then** a pessoa vê uma mensagem em português, o código de suporte da requisição e a opção de tentar de novo, e a conversa continua intacta.
4. **Given** um link de download copiado, **When** alguém tenta usá-lo fora da conversa em que foi gerado ou sem a chave de acesso do chat, **Then** o download é recusado.
5. **Given** várias exportações seguidas, **When** a pessoa pede mais arquivos do que o sistema suporta ao mesmo tempo, **Then** vê um aviso claro para aguardar e tentar de novo, sem perder os pedidos já feitos.
6. **Given** uma conversa antiga reaberta pelo histórico (ou uma consulta feita há mais de 1 hora), **When** a pessoa pede um arquivo sobre aquele resultado, **Then** o assistente explica que os dados daquela consulta não estão mais disponíveis para exportar e oferece refazer a consulta, e as respostas antigas não mostram o controle "Exportar".
7. **Given** um resultado com CPF, e-mail e telefone de alunos, **When** a pessoa exporta pelo controle ou pede o arquivo sem mencionar dados completos, **Then** esses campos saem mascarados; **When** pede explicitamente os dados completos em texto, **Then** saem completos e o cartão de download avisa isso.

---

### Edge Cases

- Resultado vazio (a consulta não achou registros): o assistente avisa e oferece ajustar a consulta, em vez de gerar arquivo só com cabeçalho; o gráfico não é criado.
- Resultado parcial (consulta que atingiu limite da API ou foi cortada): o arquivo e o gráfico carregam o mesmo aviso de resultado parcial mostrado na conversa.
- Pedido financeiro maior que 30 dias, consolidado em janelas (spec 001): o arquivo traz o período inteiro consolidado, com o período claramente informado.
- Dados pessoais de alunos (CPF, e-mail, telefone) presentes no resultado: tratados conforme a regra definida em FR-008.
- Valores nulos ou ausentes nos registros: aparecem em branco ou com marca padronizada, nunca como "null" ou "undefined".
- Textos longos ou com caracteres especiais (acentos, aspas, quebras de linha) em nomes e históricos: o arquivo os preserva sem corromper o formato.
- Texto de célula que começa com "=", "+", "-" ou "@": não pode ser interpretado como fórmula ao abrir no Excel.
- Pedido de arquivo enquanto a resposta ainda está chegando: o pedido espera ou é recusado com explicação, sem gerar arquivo parcial.
- Gráfico com categorias demais para ficar legível: o assistente agrupa ou pede para reduzir o escopo, em vez de mostrar um gráfico ilegível.
- Séries com escalas muito diferentes ou valores negativos: o gráfico continua correto e legível, ou o assistente explica por que não o mostra.
- Várias exportações do mesmo resultado: cada pedido gera um arquivo com nome distinto e prazo próprio.
- Pessoa com a conversa aberta em duas abas: um link gerado numa aba funciona somente para a mesma conversa e a mesma chave de acesso.
- Reabertura de conversa antiga e pedido de arquivo sobre dados dela: os dados não estão mais disponíveis; segue a regra de FR-024.
- Pedido de alteração de dados ("exporta e apaga os inadimplentes"): continua sendo recusado, pois a API DKSOFT é somente leitura.

## Requirements *(mandatory)*

### Functional Requirements

#### Exportação de arquivos

- **FR-001**: O sistema MUST gerar arquivos em PDF, Excel (.xlsx) e Word (.docx) a partir de um pedido da pessoa feito em texto na conversa.
- **FR-002**: O conteúdo do arquivo MUST vir dos registros já consultados na conversa e identificados de forma única; o assistente MUST NOT digitar, refazer, arredondar ou completar valores, e os totais MUST ser calculados sobre esses mesmos registros.
- **FR-003**: O sistema MUST entregar o arquivo na própria conversa, por um cartão com nome, formato, tamanho, prazo de validade e ação de baixar.
- **FR-004**: O link de download MUST expirar em prazo curto e fixo (padrão de 30 minutos) e MUST estar ligado à conversa e à chave de acesso que o gerou; tentativas de uso fora desse vínculo ou após o prazo MUST ser recusadas.
- **FR-005**: O sistema MUST aplicar um limite de linhas por arquivo (padrão de 5.000 linhas, configurável) e, ao excedê-lo, MUST informar o limite e o tamanho do resultado e sugerir como reduzi-lo, sem cortar dados em silêncio.
- **FR-006**: Todo arquivo MUST trazer título, data e hora de geração, período e filtros usados, avisos de resultado parcial quando houver, colunas com nomes legíveis em português e valores formatados em português do Brasil (reais, datas dia/mês/ano).
- **FR-007**: No Excel, valores numéricos e datas MUST ser gravados como números e datas, e textos que pareçam fórmulas MUST ser tratados como texto.
- **FR-008**: Dados pessoais de alunos (CPF, e-mail, telefone) em arquivos MUST sair mascarados por padrão, com o mesmo padrão de máscara usado nos registros de funcionamento (spec 001), e MUST sair completos somente quando a pessoa pedir isso de forma explícita no texto da conversa (por exemplo, "com o CPF completo"). O controle "Exportar" MUST gerar sempre o arquivo mascarado. Quando o arquivo sair com dados completos, o cartão de download MUST informar isso, e o registro de funcionamento MUST anotar apenas que houve pedido explícito, sem o conteúdo.
- **FR-009**: O sistema MUST NOT incluir dados pessoais no nome do arquivo.
- **FR-010**: O sistema MUST oferecer em cada resposta com dados exportáveis um controle "Exportar" com os três formatos, que gera o mesmo arquivo do pedido escrito sem nova interpretação do assistente.
- **FR-011**: O sistema MUST NOT exibir o controle de exportação em respostas sem dados exportáveis e MUST NOT gerar arquivo vazio, inventado ou sem resultado consultado; quando não houver dados, MUST explicar e oferecer a consulta.
- **FR-012**: Quando houver mais de um resultado exportável na conversa e o pedido não indicar qual, o assistente MUST informar qual vai exportar (por padrão o mais recente) ou perguntar antes de gerar.

#### Gráficos

- **FR-013**: O assistente MUST exibir um gráfico junto da resposta quando a pergunta envolver comparação entre categorias, evolução no tempo ou distribuição, e quando a pessoa pedir; nas demais respostas MUST responder só com texto.
- **FR-014**: O sistema MUST suportar gráficos de barras, de linhas e de pizza, com título, rótulos de eixo e legenda quando houver mais de uma série.
- **FR-015**: Todo gráfico MUST nascer de uma especificação estruturada (tipo, título, categorias do eixo x, séries com nome e valores) validada antes de ser exibida; especificações inválidas MUST ser descartadas, mantendo a resposta em texto íntegra e sem mensagem técnica.
- **FR-016**: Os valores do gráfico MUST vir dos registros consultados, com a mesma garantia de exatidão do FR-002.
- **FR-017**: O sistema MUST impor limites de séries e de pontos por gráfico que preservem a legibilidade e, ao excedê-los, MUST agrupar os dados ou pedir à pessoa que reduza o escopo.
- **FR-018**: Todo gráfico MUST ser acessível (WCAG 2.1 AA): título, resumo em texto, acesso aos dados em forma de tabela, uso por teclado, contraste adequado nos temas claro e escuro, distinção de séries que não dependa só de cor e layout legível no celular.
- **FR-019**: O gráfico MUST ficar guardado com a resposta no histórico e reaparecer quando a conversa for reaberta.
- **FR-020**: Quando não for possível gerar o gráfico pedido (dados insuficientes, tipo inadequado), o assistente MUST explicar em uma frase e manter a resposta em texto.
- **FR-021**: A mesma especificação do gráfico MUST poder ser incluída nos arquivos PDF, Word e Excel, quando a pessoa pedir "com gráfico", com o mesmo título e os mesmos valores do exibido na conversa e acompanhada da tabela de dados.

#### Transversais

- **FR-022**: O sistema MUST manter as regras já em vigor das specs 001 e 002: chave de acesso em toda chamada, origens autorizadas, API DKSOFT somente leitura (recusa de pedidos de alteração), um único token sem multi-tenant, token e chave do provedor nunca expostos, mensagens e arquivos em português do Brasil.
- **FR-023**: O sistema MUST registrar cada exportação e cada gráfico com identificador de requisição, formato ou tipo, quantidade de linhas, duração e resultado (sucesso, erro, limite excedido, tempo esgotado), sem registrar conteúdo, dados pessoais nem o endereço do link.
- **FR-024**: Os registros consultados MUST ficar disponíveis para exportação somente durante a sessão em que foram consultados, por no máximo 1 hora (configurável) após a consulta, e MUST NOT ser guardados além disso. Ao reabrir uma conversa pelo histórico, ou depois desse prazo, o controle "Exportar" MUST NOT aparecer nas respostas antigas, e um pedido de arquivo em texto MUST ser respondido com explicação e a oferta de refazer a consulta. Os gráficos já exibidos continuam reaparecendo (FR-019), pois a especificação do gráfico faz parte da resposta.
- **FR-025**: O sistema MUST impor um tempo máximo para gerar cada arquivo e MUST traduzir falhas (geração, tempo esgotado, limite de exportações simultâneas, link expirado) em mensagens claras em português, com código de suporte e ação de nova tentativa, sem perder a conversa.
- **FR-026**: Nenhum fluxo das specs 001 e 002 (perguntar, retomar conversas, interromper, tratar erros) pode mudar de comportamento para quem não pede arquivo nem gráfico.

### Key Entities *(include if feature involves data)*

- **Resultado consultado**: conjunto de registros devolvidos pela API DKSOFT em uma consulta da conversa, com identificador único, tipo (por exemplo contas recebidas, parcelas em aberto), período ou filtros usados, quantidade de registros e indicação de resultado parcial. É a única fonte de dados de arquivos e gráficos.
- **Pedido de exportação**: solicitação de arquivo, vinda do texto da conversa ou do controle "Exportar", com resultado de origem, formato, opção de incluir gráfico e situação (em andamento, pronto, falhou).
- **Arquivo exportado**: documento gerado em um dos três formatos, com nome, tamanho, quantidade de linhas, momento de geração e prazo de validade, ligado a uma conversa.
- **Link de download**: acesso temporário a um arquivo exportado, com prazo curto e vínculo à conversa e à chave de acesso.
- **Especificação de gráfico**: descrição estruturada de um gráfico (tipo, título, categorias, séries) ligada ao resultado consultado de onde vêm os valores e à resposta em que aparece.
- **Gráfico**: representação visual da especificação, exibida na conversa e reaproveitável nos arquivos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pessoa obtém um arquivo pronto para baixar com um único pedido ou um clique, e em até 15 segundos após o pedido para resultados de até 1.000 linhas.
- **SC-002**: Em 100% dos arquivos e gráficos verificados em amostras de conferência, os valores e totais são idênticos aos registros devolvidos pela API DKSOFT.
- **SC-003**: Em 100% das tentativas, um link vencido, usado fora da conversa de origem ou sem a chave de acesso é recusado.
- **SC-004**: Em 100% das conferências, os arquivos PDF, Word e Excel abrem sem aviso de reparo nos aplicativos de escritório mais usados e os dados em português (acentos, reais, datas) aparecem corretos.
- **SC-005**: Em perguntas de comparação, evolução e distribuição de uma amostra de teste, pelo menos 90% das respostas trazem o tipo de gráfico adequado na primeira tentativa, e nenhuma pergunta de valor único traz gráfico desnecessário.
- **SC-006**: Todos os gráficos passam na verificação de acessibilidade WCAG 2.1 AA (contraste, teclado, alternativa em texto e tabela de dados) nos temas claro e escuro.
- **SC-007**: Nenhum registro de funcionamento contém CPF, e-mail, telefone, conteúdo de arquivo ou endereço de link.
- **SC-008**: Os fluxos já validados do MVP (specs 001 e 002) continuam passando integralmente nos testes automatizados após a entrega.
- **SC-009**: Pelo menos 90% das pessoas em teste conseguem exportar um resultado no formato desejado na primeira tentativa, sem ajuda.

## Assumptions

- Esta spec evolui o MVP já validado das specs 001 (API do agente) e 002 (interface web); reaproveita chave de acesso, conversas, histórico, eventos de resposta e tratamento de erros, sem alterar o que já funciona para quem não usa as novas capacidades.
- Usuários: clientes finais, funcionários da DKSOFT e gestores de escolas usam o mesmo chat, sem perfis diferentes nesta fase (constitution, princípio IX). Um único token da API, sem multi-tenant, e a API DKSOFT continua somente leitura.
- "Dados consultados" são os registros devolvidos pela API DKSOFT durante a conversa; arquivos e gráficos usam somente esses registros e nunca valores escritos pelo modelo.
- O link expira em 30 minutos e o limite padrão é de 5.000 linhas por arquivo; ambos são configuráveis e podem ser ajustados no plano sem nova spec.
- Os três tipos de gráfico (barras, linhas, pizza) cobrem comparações, séries temporais e distribuições; outros tipos, gráficos interativos avançados e painéis fixos ficam fora de escopo.
- Por padrão, um arquivo contém só os dados (e o gráfico quando a pessoa pedir); uma narrativa gerada pelo modelo dentro do arquivo não faz parte do escopo.
- O arquivo reflete o que a pessoa já viu na conversa: as colunas são as relevantes ao resultado consultado, e o tratamento de dados pessoais segue FR-008.
- Decisões do dono do produto (31/10/2026): dados pessoais saem mascarados por padrão e completos só sob pedido explícito em texto (FR-008); a exportação vale só para os dados da sessão atual, sem guardar registros consultados além de 1 hora (FR-024). Exportar de conversas antigas com retenção maior fica para uma spec futura, se houver demanda.
- Os arquivos são gerados e guardados só pelo tempo da validade do link; não há arquivo permanente, envio por e-mail, agendamento de relatórios, modelos personalizados com logotipo do cliente nem exportação da transcrição da conversa nesta fase.
- Voz continua fora de escopo e tem spec própria.
- A geração de PDF, Word e Excel e a exibição de gráficos provavelmente exigirão novas bibliotecas nos pacotes `api/` e `web/`; se isso afetar a stack obrigatória da constitution, será tratado como amendment no plano, e não nesta spec.
- O guardar de arquivos fora da memória do servidor (necessário por causa da implantação em máquinas efêmeras) é decisão de plano, mas o prazo de vida do arquivo segue o do link.
- O design system Modernist é a fonte visual do cartão de arquivo, do controle "Exportar" e dos gráficos; a paleta dos gráficos deve funcionar nos temas claro e escuro e respeitar a regra de reservar o vermelho do acento para ação principal e destaques pequenos.
- Suporte de navegadores: versões atuais dos principais navegadores para computador e celular, e dos aplicativos de escritório mais usados para abrir os arquivos.
