# Politica de Dados para Uso de IA

Este documento descreve quais informacoes podem ser enviadas para a API da OpenAI e quais devem permanecer apenas no banco de dados ou nos servicos internos do chatbot.

## Objetivo

Aplicar minimizacao de dados antes de qualquer chamada ao modelo, mantendo a IA apenas como camada de humanizacao de texto. A IA nao decide fluxo, procedimento, diagnostico, urgencia, disponibilidade ou confirmacao de agenda.

## Dados Permitidos

- Primeiro nome do paciente, apenas quando necessario para tornar a resposta natural.
- Mensagem atual do paciente com dados sensiveis removidos.
- Historico recente minimizado, somente quando `OPENAI_HUMANIZATION_HISTORY_LIMIT` for maior que `0`.
- Texto aprovado pelo Flow, gerado deterministicamente pelo sistema.
- Intencao do fluxo, como `AGENDAMENTO`, `SINTOMA`, `DUVIDA` ou `OUTRO`.

## Dados Bloqueados ou Removidos

- CPF.
- E-mail.
- Telefone.
- Data de nascimento.
- Endereco e CEP.
- Numeros longos identificaveis.
- Fotos, imagens clinicas e arquivos.
- Dados brutos de anamnese que nao sejam necessarios para reformular uma pergunta previamente aprovada.

## Implementacao no Codigo

A sanitizacao fica centralizada em `src/services/AIDataPolicyService.js`.

Antes de montar o payload da OpenAI, o `OpenAIService` chama:

```js
AIDataPolicyService.prepareHumanizationContext()
```

Essa etapa:

- reduz o nome completo para primeiro nome;
- remove CPF, telefone, e-mail, data de nascimento, CEP/endereco e numeros longos;
- sanitiza o historico recente antes do envio;
- preserva apenas o texto necessario para humanizacao.

## Configuracao

```env
OPENAI_DATA_POLICY=lgpd_minimal
OPENAI_HUMANIZATION_MODE=smart
OPENAI_HUMANIZATION_HISTORY_LIMIT=0
OPENAI_DEBUG_PAYLOAD=compact
```

O modo `smart` reduz chamadas de IA em fluxos operacionais. O historico `0` evita envio de conversa anterior para o modelo. O debug `compact` evita imprimir o payload integral no console.

## Observacao LGPD

O sistema ainda deve manter no banco os dados necessarios ao atendimento, como cadastro, anamnese e agendamento. A politica acima trata especificamente do envio para IA externa, aplicando minimizacao e reducao de exposicao.

## Limites e verificacao da Sprint 2

O filtro usa padroes conhecidos; nao assegura a remocao de todo endereco,
nome ou identificador possivel em texto livre e nao comprova conformidade
LGPD integral. A equipe precisa definir finalidade, base legal, acesso,
retencao e tratamento das solicitacoes dos titulares.

O texto aprovado tambem passa pelo filtro; quando possui identificadores
reconhecidos, o humanizador entrega a resposta local sem chamar a API.
Entrada livre limitada a 500 caracteres e historico a quatro itens de 300
caracteres. O modo smart evita envio das conversas de triagem e agendamento.

Metricas em `logs/ai-usage` guardam apenas modelo, tokens, status e latencia.
Debug de conversas pode conter dados pessoais e deve ser desativado no uso real.
Os testes de seguranca usam dados sinteticos. Ver `sprint2-entrega.md`.
