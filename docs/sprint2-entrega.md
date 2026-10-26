# Entrega tecnica da Sprint 2

Data: 16/10/2026. Fonte: aba `Sprint 2`, linhas 2 a 15 de
`entregas_sprints_tcc2_1_atualizado.xlsx`. A planilha original foi preservada.

## Resultado verificado

- Suite automatizada: **75 testes aprovados**, nenhuma falha ou teste ignorado.
- MySQL real: consulta e anamnese criadas, lidas e conferidas dentro de uma
  transacao revertida. Duracao, status pendente, procedimento nas observacoes,
  vinculo com paciente e conflito de horario conferidos. Paciente sintetico
  ausente apos rollback. O teste nao altera o schema; IDs auto incrementais
  podem apresentar lacunas por causa do rollback.
- OpenAI real: uma saudacao sintetica, resposta aceita pelo guardrail,
  201 tokens de entrada, 9 de saida, total 210, cache 0, latencia 3187 ms.
  Isso comprova uma chamada, nao uma media de desempenho ou seguranca geral.
- Simulacao offline: limpeza, triagem, implante com anamnese e atendimento sem
  agendamento concluidos. Banco, envio WhatsApp e Calendar simulados nesses replays.
- Carga local: 100 conversas, lotes de 10, p50 7,14 ms e p95 9,91 ms por conversa.
  A simulacao nao mede rede, MySQL, disponibilidade do WhatsApp ou geracao real.

## Rastreabilidade

| Linha | Entrega da sprint | Implementacao e evidencia | Validacao restante |
| --- | --- | --- | --- |
| 2 | Refinar prompts | Instrucoes compactas, contexto nao confiavel, limites de entrada/historico; `Sprint2Security.test.js`; chamada sintetica real | Avaliacao humana da naturalidade em conversas reais |
| 3 | Integrar triagem | `TriagemFlow`, foto opcional, data/hora, relatorio; `Flows.test.js` e `Sprint2Scenarios.test.js` | Aceite clinico pelo orientador/equipe |
| 4 | Integrar agendamento | Fluxos, disponibilidade, transacao serializable e duracao consistente; teste MySQL real; contratos Calendar testados | Revalidar evento/convite real na agenda e WhatsApp |
| 5 | Relatorio preliminar | `PatientReportService`, necessidade/complexidade/anamnese/data, foto; testes de relatorio e replays completos | Revisao do conteudo pela equipe com caso autorizado |
| 6 | Bloquear recomendacoes clinicas | Prompt, validacao local e fallback; candidatos com diagnostico, medicamento, deboche e procedimento indevido rejeitados | Avaliacao adversarial ampliada com modelo real |
| 7 | Registrar tokens | `AIUsageService`, JSONL diario, `metrics:ai`; consumo real e ausencia de usage distintos | Acompanhar uso operacional ao longo do tempo |
| 8 | Otimizar tokens | Modo smart, mensagem limitada a 500 caracteres, ate 4 itens de historico de 300 caracteres; replays always/smart | Comparar tokens faturados e naturalidade em amostra real pareada |
| 9 | Desempenho | `benchmark:sprint2`, carga local e p50/p95; uma chamada real medida | Medir p95 ponta a ponta no ambiente de atendimento |
| 10 | Formas de escrita | Datas relativas/curtas, horarios naturais, erros simples, saudacoes, recusas e confirmacoes; suite existente e novos replays | Ampliar corpus com casos autorizados |
| 11 | Continuidade/contexto | Conversa de anamnese de 13 mensagens, pacientes intercalados, historico limitado; sintomas durante anamnese nao reiniciam fluxo | Sessoes continuam em memoria; reinicio do processo encerra contexto |
| 12 | Registros do banco | `test:db`, valida consulta, anamnese e rejeicao de conflito no MySQL com rollback | Teste de carga concorrente no banco de homologacao |
| 13 | Seguranca/dados sensiveis | Filtros, texto aprovado sensivel mantido local, metricas sem conteudo clinico, teste de respostas incompletas/429/timeout | Revisao de governanca, acesso e retencao pela equipe |
| 14 | Cenarios simulados | Quatro replays completos; foto antecipada; negativa de confirmacao; contexto separado | Aceite ponta a ponta no canal real |
| 15 | Comparacao MVP | Mesmos quatro roteiros no commit `10c95b9` e codigo atual, IA simulada igual; JSON em `docs/evidence/sprint2-benchmark.json` | Comparacao de linguagem dos modelos reais |

As implementacoes e verificacoes tecnicas acima foram realizadas. Itens que
exigem caso real, aprovacao humana ou medicao prolongada permanecem em
validacao; nao devem ser marcados como homologados apenas por testes automaticos.

## Correcoes desta entrega

1. `Nao esta certo` na triagem nao confirma mais a consulta.
2. Foto recebida antecipadamente nao preenche tempo/localizacao/caracteristica
   com texto vazio nem pula uma pergunta obrigatoria.
3. Sintomas mencionados como resposta a anamnese nao descartam as respostas
   anteriores nem reiniciam a triagem.
4. Duracao persistida acompanha a duracao usada na oferta de horarios.
5. Disponibilidade e insercao da consulta compartilham transacao e bloqueio de
   leitura no InnoDB. Deadlocks/erros mantem o fluxo aberto para nova tentativa.
6. Respostas incompletas da API nao sao entregues como texto final.
7. Contexto enviado a IA tem limites de tamanho. Quando o texto aprovado possui
   identificadores reconhecidos pelo filtro, a resposta e entregue localmente.
8. Metricas registram tokens retornados pelo provedor, latencia e status, sem
   mensagem, anamnese, nome, telefone ou credenciais.

## Comparacao reproduzivel

`npm run benchmark:sprint2` carrega a revisao anterior em memoria pelo Git,
sem trocar arquivos da arvore de trabalho. Rede bloqueada no benchmark; IA
devolve o texto aprovado para isolar o comportamento do fluxo. Modulos sao
preaquecidos antes da medicao. O loader historico existe apenas no script de
avaliacao; nao ha dependencia do provedor anterior em producao.

| Roteiro | MVP 10c95b9 | Atual |
| --- | --- | --- |
| Limpeza, `as 15h`, `certinho` | Nao encerra | Encerra, persiste Limpeza e solicita publicacao no Calendar |
| Triagem com recusa de foto | Encerra | Encerra e solicita publicacao no Calendar |
| Implante com anamnese | Encerra | Encerra, salva anamnese e solicita publicacao no Calendar |
| Triagem, `decido depois` | Encerra sem consulta | Encerra sem consulta, data pendente |

No codigo atual, os mesmos quatro roteiros somam 18 chamadas ao humanizador
em `always` e 1 em `smart`: **94,4% menos chamadas simuladas**. Essa porcentagem
nao representa economia medida de tokens/dinheiro. A qualidade verificada aqui
e preservacao do contrato do fluxo; a IA simulada nao avalia naturalidade.

## Como repetir

```sh
npm test
npm run benchmark:sprint2
npm run test:db
npm run test:openai:live
npm run metrics:ai
```

`test:db` requer MySQL configurado e tabelas InnoDB; usa apenas dados sinteticos
e reverte a transacao. `test:openai:live` faz uma chamada paga com saudacao
sintetica e grava consumo separado em `logs/validation-ai`. Os testes unitarios
nao precisam de chamadas reais e nao devem alimentar as metricas operacionais.

## Limites operacionais

- Guardrails por regras reduzem riscos, mas nao provam ausencia de toda
  recomendacao clinica possivel. Manter `OPENAI_HUMANIZATION_MODE=smart`.
- Complexidade e uma regra de encaminhamento preliminar, nao diagnostico nem
  classificacao clinica de urgencia validada.
- Filtros de dados por padroes nao garantem anonimato; texto livre pode conter
  dados identificaveis nao reconhecidos. Nao equivale a conformidade LGPD integral.
- Fotos e relatorios enviados ao grupo e ao Calendar exigem acesso restrito
  aos destinatarios autorizados. Debug detalhado deve ficar desligado no uso real.
- Falhas de publicacao do Calendar/relatorio sao registradas no console; nao ha
  fila duravel de reenvio. O registro local da consulta continua pendente.
- Sessoes sao locais ao processo. Multiplas instancias precisam de armazenamento
  compartilhado de contexto antes de receber o mesmo paciente em instancias diferentes.

Fonte tecnica para usage/cache: https://developers.openai.com/api/docs/guides/prompt-caching
