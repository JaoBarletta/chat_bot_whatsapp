# Logs de validacao das Sprints 1 e 2

Os registros abaixo avaliam exclusivamente a versao atual. Nenhuma metrica de
comparacao com LLM local, custo antigo ou desempenho antigo entra neste resumo.
O script de benchmark historico desativa esses logs durante sua execucao.

## Uso

Reinicie o bot para carregar a instrumentacao. Por padrao, os eventos aparecem
no console com prefixo `[VALIDACAO]` e sao persistidos diariamente em
`logs/validation/AAAA-MM-DD.jsonl` (data UTC).

```sh
npm run metrics:validation
npm run metrics:validation -- 2026-10-16
npm run metrics:validation -- 2026-10-16 --json
npm run validate:sprints
npm run metrics:ai
```

`metrics:validation` apresenta contagens por evento/status, motivos, media,
p50/p95 e numero de amostras de latencia, tokens e taxa de fallback.
`--json` emite o resumo estruturado. `validate:sprints` roda a suite atual e
grava testes aprovados/reprovados/ignorados, duracao e codigo de saida. Cada
execucao permanece no historico, inclusive falhas corrigidas depois; consulte
a ultima execucao para conhecer o estado atual da suite.

`metrics:ai` continua disponivel para consumo diario por modelo em
`logs/ai-usage`. Esses tokens tambem aparecem no resumo de validacao: **nao
some as duas fontes**, pois representam as mesmas chamadas.

## O que e medido

| Evento | Dados / evidencia | Sprint |
| --- | --- | --- |
| `ai.request` | Modelo, versao do prompt, intencao, tamanho da entrada/instrucoes, limite de saida/timeout, historico enviado, indicacao de filtragem e truncagem | 1 e 2 |
| `ai.response` | Sucesso/erro/timeout, HTTP quando disponivel, causa categorica, latencia, tokens de entrada/saida/cache/total retornados pela API | 1 e 2 |
| `ai.skipped` | API nao chamada por cooldown ou falta de chave | 1 |
| `humanizer.decision` | Resposta aceita, fallback ou chamada evitada; motivo: contrato, afirmacao clinica, tom desrespeitoso, rotulo, politica do fluxo/modo/dados ou indisponibilidade | 1 e 2 |
| `routing.decision` | Intencao escolhida pelas regras locais | 1 e 2 |
| `flow.started`, `flow.interrupted`, `flow.cancelled` | Inicio, mudanca para humano/sintomas e cancelamento | 2 |
| `flow.transition` | Etapa anterior/posterior, intencao, encerramento e possibilidade de relatorio | 2 |
| `message.buffer` | Numero de fragmentos, presenca de imagem, tempo de agrupamento e espera na fila | 2 |
| `message.process` | Tempo total do handler e falhas nao tratadas pelo fluxo | 2 |
| `whatsapp.reply` | Resultado e duracao do envio da resposta; quantidade de caracteres | 2 |
| `attendance.completed` | Encerramento de atendimento reportavel, presenca de agendamento/anamnese/foto, sem conteudo clinico | 2 |
| `db.patient_lookup`, `db.patient_registration` | Resultado e duracao da consulta/cadastro | 1 e 2 |
| `db.appointment` | Resultado da transacao de agendamento, duracao e codigo seguro de erro/conflito | 2 |
| `db.anamnesis`, `db.history` | Resultado da persistencia de anamnese e historico | 2 |
| `report.callback` | Execucao do callback de relatorio; nao implica entrega WhatsApp | 2 |
| `whatsapp.report`, `whatsapp.photo` | Resultado real das chamadas de envio ao grupo e da foto | 2 |
| `calendar.publish`, `calendar.result` | Duracao e resultado: criado, ja existente, desativado, sem agendamento ou erro | 2 |
| `test.suite` | Totais da suite automatizada e duracao | 1 e 2 |

## Interpretacao correta

- `traceId` liga os eventos de uma mensagem processada. `conversation` e um
  identificador derivado com chave aleatoria por processo; permite acompanhar
  continuidade sem gravar telefone. `runId` identifica a execucao do bot.
  Os identificadores de conversa mudam ao reiniciar o processo.
- O evento do buffer possui seu proprio trace, mas pode ser ligado pelo campo
  `conversation`. `message.process` inclui consultas, humanizacao e integracoes;
  exclui a espera anterior no buffer/fila. `whatsapp.reply` mede a chamada de
  envio, nao o tempo ate leitura pelo paciente.
- `humanizer.decision:skipped` e uma decisao deliberada de usar texto local,
  nao uma falha da API. A taxa de fallback usa `fallback / (accepted + fallback)`;
  chamadas evitadas nao entram nesse denominador.
- Contadores de `ai.response` sao tentativas efetivamente realizadas; cooldown
  e chave ausente aparecem em `ai.skipped`, sem consumo atribuido.
- Tokens ausentes permanecem `null` e aparecem como consumo desconhecido.
  Cache integra tokens de entrada: nao e somado novamente ao total. Nao ha
  estimativa monetaria sem tabela de precos validada.
- Falha capturada internamente pode produzir `message.process:success`, pois o
  bot respondeu com fallback. Consulte eventos da integracao e do humanizador
  para identificar degradacao.
- `db.appointment:success` e emitido apos commit da transacao gerenciada pelo
  servico. Anamnese com `external_transaction_pending` ainda depende do commit
  do chamador; nao representa persistencia definitiva.
- `attendance.completed` descreve o encerramento do fluxo. Relatorio enviado
  e Calendar publicado sao resultados independentes, registrados depois.
- `calendar.publish:success` significa retorno do servico, que pode estar
  desativado; a criacao e indicada exclusivamente por `calendar.result:created`.
  Evento ja existente nao comprova um novo convite entregue.
- `hasAnamnesis` indica presenca de respostas, nao qualidade/completude clinica.
  Repeticao de etapa nao prova falha: pode ser uma solicitacao de esclarecimento.
- Contagem de eventos nao equivale a pacientes unicos ou atendimentos unicos
  entre reinicios. Abandono, satisfacao, naturalidade e adequacao clinica exigem
  criterios e avaliacao humana; os logs nao inventam esses resultados.

## Dados e configuracao

```env
VALIDATION_LOG_ENABLED=true
VALIDATION_LOG_CONSOLE=true
VALIDATION_LOG_DIR=logs/validation
```

Para manter somente arquivos, use `VALIDATION_LOG_CONSOLE=false`. Para desativar
essa instrumentacao, use `VALIDATION_LOG_ENABLED=false`. A lista permitida de
campos exclui prompts, respostas, nomes, CPF, telefone, e-mail, fotos, IDs de
paciente, tokens de autenticacao, stack traces e mensagens brutas de erro.
Somente categorias de erro reconhecidas sao registradas.

Os logs antigos de debug sao independentes e podem imprimir dados pessoais:
use `OPENAI_DEBUG=false` e `GOOGLE_CALENDAR_DEBUG=false` no atendimento real.
Os arquivos de validacao ficam fora do Git. Defina acesso restrito e prazo
de retencao para o TCC; pseudonimizacao nao equivale a anonimato garantido.
Falha de gravacao em disco gera aviso e nao interrompe o atendimento.

Testes unitarios normalmente desativam telemetria; o teste do logger usa um
diretorio temporario. `validate:sprints` registra somente o resultado agregado
da suite. O smoke test real da OpenAI grava eventos em `logs/validation-smoke`
e consumo em `logs/validation-ai`, separados da operacao.

Os novos logs comecam a ser produzidos apos esta implementacao; nao reconstituem
eventos antigos que nunca foram registrados. O resumo nao le evidencias do
benchmark historico nem logs do provedor local anterior.
