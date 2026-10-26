# chat_bot_whatsapp

Bot de atendimento para WhatsApp feito em Node.js. O projeto usa Baileys para conectar no WhatsApp, Sequelize + MySQL para persistencia, e possui fluxo de atendimento, agendamento e geracao de relatorios.

## Requisitos

- Node.js instalado
- MySQL em execucao
- Conta do WhatsApp para autenticar o bot via QR Code
- Chave da OpenAI API para humanizacao das respostas

## Dependencias

As dependencias principais do projeto sao:

- @whiskeysockets/baileys
- dotenv
- mysql2
- qrcode-terminal
- sequelize
- node-cron

## Instalacao

1. Abra o projeto na sua maquina.
2. Instale as dependencias:

```bash
npm install
```

## Configuracao do arquivo .env

Crie um arquivo `.env` na raiz do projeto com as variaveis abaixo.

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=chat_bot_whatsapp
DB_USER=root
DB_PASSWORD=sua_senha

OPENAI_API_KEY=sua_chave_openai
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5-mini
OPENAI_TIMEOUT_MS=30000
OPENAI_RETRY_COOLDOWN_MS=60000
OPENAI_MAX_OUTPUT_TOKENS=100
OPENAI_HUMANIZATION_MODE=smart
OPENAI_HUMANIZATION_HISTORY_LIMIT=0
OPENAI_PROMPT_CACHE_KEY=tcc_dental_humanizer_v1
OPENAI_DATA_POLICY=lgpd_minimal
OPENAI_DEBUG=true
OPENAI_DEBUG_PAYLOAD=compact

GOOGLE_CALENDAR_ENABLED=false
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REFRESH_TOKEN=
GOOGLE_CALENDAR_ID=primary
GOOGLE_CALENDAR_TIMEZONE=America/Sao_Paulo
GOOGLE_CALENDAR_SEND_UPDATES=all
GOOGLE_CALENDAR_LOCATION=
GOOGLE_CALENDAR_DEBUG=false

REPORT_GROUP_NAME=Relatorios TCC
BAILEYS_VERSION=
BAILEYS_LOG_LEVEL=silent
APPOINTMENT_OPEN_HOUR=08:00
APPOINTMENT_CLOSE_HOUR=18:00
APPOINTMENT_SLOT_MINUTES=30
MESSAGE_DEBOUNCE_MS=3000
```

## Como rodar

Depois de configurar o banco e o `.env`, inicie o bot com:

```bash
npm start
```

Na primeira execucao, o sistema vai:

- conectar no MySQL
- sincronizar os modelos do Sequelize
- exibir um QR Code no terminal para autenticar o WhatsApp
- salvar a sessao na pasta `auth/`

## Login do WhatsApp

1. Rode o projeto com `npm start`.
2. Abra o WhatsApp no celular.
3. Escaneie o QR Code exibido no terminal.
4. Depois da autenticacao, a sessao fica salva na pasta `auth/`.

Se a sessao for perdida, apague o conteudo da pasta `auth/` e autentique novamente.

## Testes

O projeto possui testes automatizados e voce pode executa-los com:

```bash
npm test
```

Para validar especificamente IA, politicas de dados e fluxos conversacionais:

```bash
npm run test:ia
```

## Google Calendar

Para ativar a criacao de eventos no Google Calendar:

1. Habilite a Google Calendar API no projeto do Google Cloud.
2. Gere credenciais OAuth para a conta que tera permissao de escrita na agenda da clinica.
3. Gere um refresh token com escopo `https://www.googleapis.com/auth/calendar.events` ou `https://www.googleapis.com/auth/calendar`.
4. Preencha `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN` e `GOOGLE_CALENDAR_ID`.
5. Altere `GOOGLE_CALENDAR_ENABLED=true`.

O paciente sera adicionado como convidado quando o cadastro tiver um e-mail valido. O envio do convite usa `GOOGLE_CALENDAR_SEND_UPDATES=all`.

## Estrutura geral

- `index.js`: ponto de entrada da aplicacao
- `docs/`: politica de dados, backlog de IA e testes comparativos
- `src/database/`: conexao com o MySQL
- `src/services/`: regras de negocio e integracoes
- `src/flows/`: fluxos de atendimento
- `src/handlers/`: processamento das mensagens recebidas
- `test/`: testes automatizados
- `auth/`: arquivos de autenticacao gerados pelo Baileys

## Evidencias da Sprint 2

Para acompanhar a validacao atual das duas sprints, use `npm run metrics:validation`.
Para executar os testes e registrar o resultado, use `npm run validate:sprints`.
Eventos e criterios estao em [docs/logs-validacao-sprints.md](docs/logs-validacao-sprints.md).
Esse resumo nao inclui comparacoes com o MVP antigo.

Entregas, resultados e limites de validacao estao em [docs/sprint2-entrega.md](docs/sprint2-entrega.md).

- `npm test`: regressao automatizada, incluindo cenarios completos e seguranca.
- `npm run benchmark:sprint2`: comparacao offline com `10c95b9` e carga simulada.
- `npm run test:db`: valida dados sinteticos no MySQL e reverte a transacao.
- `npm run test:openai:live`: uma chamada real paga, somente com saudacao sintetica.
- `npm run metrics:ai`: consumo por dia/modelo, falhas, consumo desconhecido e p95.

O consumo fica em `logs/ai-usage/AAAA-MM-DD.jsonl`, fora do Git. Pode ser
configurado por `OPENAI_USAGE_DIR` e desativado por `OPENAI_USAGE_ENABLED=false`.
Nao guarda mensagens nem dados clinicos. Tokens ausentes permanecem desconhecidos;
tokens de cache ja fazem parte dos tokens de entrada. O operador deve definir
retencao e acesso aos arquivos. Testes reais da API usam `logs/validation-ai`.

## Observacoes de operacao

- O projeto depende de banco MySQL disponivel antes de iniciar.
- As tabelas sao sincronizadas automaticamente na inicializacao.
- Se a OpenAI API nao estiver disponivel, o bot continua funcionando com fallback local.
- `OPENAI_HUMANIZATION_MODE=smart` evita chamadas de IA em fluxos operacionais, como agendamento, triagem, datas, horarios e confirmacoes. Use `always` apenas para depurar ou comparar com o comportamento antigo.
- `OPENAI_HUMANIZATION_HISTORY_LIMIT=0` nao envia historico recente para o humanizador. Aumente para `2` ou `4` somente se precisar dar contexto extra para respostas abertas.
- `OPENAI_DATA_POLICY=lgpd_minimal` aplica minimizacao antes da IA: envia no maximo primeiro nome, remove CPF, e-mail, telefone, data de nascimento, endereco/CEP e numeros longos do contexto.
- `OPENAI_DEBUG_PAYLOAD=compact` mostra no console um resumo do payload. Use `full` apenas em depuracao pontual, porque imprime o prompt inteiro.
- Quando `GOOGLE_CALENDAR_ENABLED=true`, o bot cria um evento no Google Calendar ao finalizar um agendamento com data e horario. O paciente entra como convidado se o cadastro tiver e-mail valido.
- A integracao usa OAuth com `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` e `GOOGLE_CALENDAR_REFRESH_TOKEN`. Para notificar convidados por e-mail, o envio usa `GOOGLE_CALENDAR_SEND_UPDATES=all`.
- O Baileys busca automaticamente a versao atual do WhatsApp Web. Use `BAILEYS_VERSION` apenas se precisar travar uma versao manualmente, por exemplo `2.3000.123456789`.
- Com `gpt-5-mini` e modelos da familia `o`, o bot nao envia `temperature`, porque a API rejeita esse parametro nesses modelos. Se trocar para um modelo compativel, `OPENAI_TEMPERATURE` pode ser configurado opcionalmente.
- Com `OPENAI_DEBUG=true`, o terminal mostra o payload enviado para a OpenAI, a resposta bruta, a resposta sanitizada e a decisao dos guard rails. Desative em producao para nao expor dados do paciente no console.
- Com `GOOGLE_CALENDAR_DEBUG=true`, o terminal mostra o evento enviado para o Google Calendar e a resposta da API. Desative em producao para nao expor dados do paciente.
- `BAILEYS_LOG_LEVEL=silent` evita os logs JSON internos do Baileys. Use `warn`, `info` ou `debug` apenas quando estiver investigando a conexao do WhatsApp.
