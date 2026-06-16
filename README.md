# chat_bot_whatsapp

Bot de atendimento para WhatsApp feito em Node.js. O projeto usa Baileys para conectar no WhatsApp, Sequelize + MySQL para persistencia, e possui fluxo de atendimento, agendamento e geracao de relatorios.

## Requisitos

- Node.js instalado
- MySQL em execucao
- Conta do WhatsApp para autenticar o bot via QR Code
- Opcional: Ollama local para recursos de IA e humanizacao de respostas

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

OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_TIMEOUT_MS=30000
OLLAMA_RETRY_COOLDOWN_MS=60000
OLLAMA_DEBUG=false

REPORT_GROUP_NAME=Relatorios TCC
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

## Estrutura geral

- `index.js`: ponto de entrada da aplicacao
- `src/database/`: conexao com o MySQL
- `src/services/`: regras de negocio e integracoes
- `src/flows/`: fluxos de atendimento
- `src/handlers/`: processamento das mensagens recebidas
- `test/`: testes automatizados
- `auth/`: arquivos de autenticacao gerados pelo Baileys

## Observacoes

- O projeto depende de banco MySQL disponivel antes de iniciar.
- As tabelas sao sincronizadas automaticamente na inicializacao.
- Se o Ollama nao estiver disponivel, o bot continua funcionando com fallback local.
