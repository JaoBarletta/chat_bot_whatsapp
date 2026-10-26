# Backlog de Atividades da IA

Este documento consolida as atividades em progresso e a fazer da planilha do projeto, com o respectivo ponto de implementacao no codigo.

## Em Progresso

### Elaboracao e refinamento dos prompts utilizados pelo agente

Aplicado em:

- `src/services/OpenAIService.js`
- `src/services/ResponseHumanizerService.js`
- `src/services/AIResponseGuardService.js`

Situacao atual:

- Prompt reduzido e focado apenas em humanizacao.
- Guard rails impedem diagnostico, escolha de tratamento, humor inadequado e labels como `Paciente:` ou `Atendente:`.
- Modo `smart` evita chamadas de IA em etapas operacionais.

### Tratamento de respostas inesperadas ou inconsistentes

Aplicado em:

- `src/services/AIResponseGuardService.js`
- `src/services/ResponseHumanizerService.js`
- `test/ResponseHumanizerService.test.js`

Situacao atual:

- Resposta da IA passa por sanitizacao.
- Resposta com rotulo de roteiro e conteudo incoerente e rejeitada.
- Caso invalido usa fallback deterministico do Flow.

## A Fazer Convertido em Implementacao

### Definir quais informacoes podem ser enviadas ao modelo

Aplicado em:

- `src/services/AIDataPolicyService.js`
- `docs/politica-dados-ia-lgpd.md`

Regras implementadas:

- Enviar no maximo o primeiro nome do paciente.
- Remover CPF, telefone, e-mail, nascimento, endereco/CEP e numeros longos.
- Nao enviar foto ou arquivo clinico para a IA.

### Adequar tratamento de dados a LGPD

Aplicado em:

- `src/services/AIDataPolicyService.js`
- `README.md`
- `docs/politica-dados-ia-lgpd.md`

Controles implementados:

- Minimizacao de dados antes da OpenAI.
- Historico de conversa desativado por padrao.
- Debug compacto para nao imprimir prompt completo.

### Implementar controle de erros, timeout e indisponibilidade da API

Aplicado em:

- `src/services/OpenAIService.js`
- `test/OpenAIService.test.js`

Controles implementados:

- Timeout por `AbortController`.
- Cooldown temporario quando a API falha.
- Fallback local quando a IA esta indisponivel.
- Teste automatizado de timeout.

### Rodar testes iniciais comparando nova arquitetura com prototipo anterior

Aplicado em:

- `docs/testes-comparativos-arquitetura.md`
- `package.json`

Situacao atual:

- Casos comparativos documentados.
- Suite automatizada cobre fluxo, triagem, agendamento, IA, LGPD e Calendar.
