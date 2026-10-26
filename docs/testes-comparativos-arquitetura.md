# Testes Comparativos da Arquitetura

Este documento registra os principais casos usados para comparar o comportamento da arquitetura atual com o prototipo anterior.

## Criterios Avaliados

- Separacao entre decisao de fluxo e humanizacao.
- Capacidade de entender mensagens naturais e fragmentadas.
- Tratamento de datas e horarios.
- Bloqueio de diagnostico pela IA.
- Fallback deterministico em caso de erro ou resposta invalida.
- Minimizacao de dados enviados ao modelo.
- Integracao com banco, relatorio de atendimento e Google Calendar.

## Casos Executados

| Caso | Entrada | Resultado esperado | Cobertura |
| --- | --- | --- | --- |
| Saudacao simples | `Oi` | Resposta acolhedora sem relatorio | `ConversationTone.test.js`, `MessageHandlerReport.test.js` |
| Mensagem fragmentada | `Ola` + `boa tarde` + `tudo bem?` | Buffer agrupa antes de responder | `IncomingMessageBuffer.test.js` |
| Agendamento com procedimento | `Quero agendar uma limpeza` | Fluxo reconhece `Limpeza` e pergunta data | `ConversationTone.test.js`, `Flows.test.js` |
| Pergunta de disponibilidade | `quais datas tem disponiveis?` | Bot lista proximas datas livres | `Flows.test.js` |
| Horario natural | `as 3 esta bom` | Bot interpreta como `15:00` quando esse slot existe | `Flows.test.js` |
| Confirmacao natural | `certinho` | Bot finaliza agendamento | `Flows.test.js` |
| Dor durante agendamento | `estou com dor de dente` | Fluxo muda para triagem | `MessageHandlerConversation.test.js` |
| Recusa de foto | `Nao consigo tirar foto` | Triagem segue sem exigir comando fixo | `Flows.test.js` |
| Resposta invalida da IA | Rotulos `Paciente:` / `Atendente:` | Guard rail rejeita e usa fallback local | `ResponseHumanizerService.test.js`, `OpenAIService.test.js` |
| Timeout da API | Chamada abortada | Bot usa fallback deterministico | `OpenAIService.test.js` |
| Dados sensiveis | CPF, telefone e e-mail no texto | Dados removidos antes do modelo | `AIDataPolicyService.test.js`, `OpenAIService.test.js` |
| Google Calendar | Agendamento finalizado | Evento criado com resumo e convidado quando ha e-mail | `GoogleCalendarService.test.js`, `MessageHandlerReport.test.js` |

## Resultado Atual

A suite automatizada atual cobre os casos principais da nova arquitetura. Para rodar:

```bash
npm test
```

Para rodar somente os testes ligados a IA e fluxo conversacional:

```bash
npm run test:ia
```

## Comparacao com o Prototipo Anterior

O prototipo anterior concentrava boa parte da decisao no `index.js` e dependia fortemente de regex e do Ollama para gerar respostas. A arquitetura atual separa:

- `FlowRouter`: classificacao local da intencao;
- `Flows`: controle de etapas e regras de negocio;
- `OpenAIService`: humanizacao controlada;
- `AIDataPolicyService`: minimizacao LGPD antes da IA;
- `AIResponseGuardService`: validacao e limpeza de respostas;
- `GoogleCalendarService`: publicacao de eventos externos.

Essa divisao reduz acoplamento, facilita testes e melhora rastreabilidade para o TCC.
