'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  downloadMediaMessage,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const Database = require('./src/database/connection');
const UserService = require('./src/services/UserService');
const AtendimentoService = require('./src/services/AtendimentoService');
const AgendamentoService = require('./src/services/AgendamentoService');
const AnamneseService = require('./src/services/AnamneseService');
const MessageService = require('./src/services/MessageService');
const NotificationService = require('./src/services/NotificationService');
const MessageHandler = require('./src/handlers/MessageHandler');
const WhatsAppReportService = require('./src/services/WhatsAppReportService');
const IncomingMessageBuffer = require('./src/services/IncomingMessageBuffer');

const authDirectory = path.join(__dirname, 'auth');
const lidPhoneCache = new Map();
let databaseInitialized = false;
let notificationsStarted = false;
const reportDeliveryService = new WhatsAppReportService();

const messageHandler = new MessageHandler({
  sendMessage: (to, message) => MessageService.send(to, message),
  onAttendanceCompleted: async ({ report, photo, patient }) => {
    console.log('\nRELATORIO PARA O DENTISTA:\n');
    console.log(report);
    await reportDeliveryService.send({ report, photo, patient });
  },
});
const incomingMessageBuffer = new IncomingMessageBuffer({
  processMessage: (payload) => messageHandler.handle(payload),
  waitMs: process.env.MESSAGE_DEBOUNCE_MS || 3000,
  onError: async (error, { conversationId }) => {
    console.error('Erro ao processar mensagem:', error.message);
    await MessageService.send(conversationId, {
      text: 'Nao foi possivel processar sua mensagem agora. Tente novamente em instantes.',
    });
  },
});

function writeLog(scope, level, message, details = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${scope}] [${level}] ${message}`);

  if (details) {
    console.log(JSON.stringify(details, null, 2));
  }
}

function normalizeBaileysLogArgs(args) {
  let message = '';
  let details = null;

  for (const arg of args) {
    if (typeof arg === 'string') {
      message = message ? `${message} ${arg}` : arg;
      continue;
    }

    if (arg instanceof Error) {
      message = message || arg.message;
      details = {
        name: arg.name,
        message: arg.message,
      };
      continue;
    }

    if (arg && typeof arg === 'object') {
      details = details || arg;
      if (!message && typeof arg.msg === 'string') {
        message = arg.msg;
      }
    }
  }

  return {
    message: message || 'Evento do Baileys',
    details,
  };
}

function createBaileysLogger() {
  const configuredLevel = String(
    process.env.BAILEYS_LOG_LEVEL || 'silent'
  ).toLowerCase();
  const levels = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
    silent: 999,
  };
  const minimumLevel = levels[configuredLevel] || levels.silent;
  const logger = {
    level: configuredLevel,
    child() {
      return logger;
    },
  };

  for (const [level, weight] of Object.entries(levels)) {
    if (level === 'silent') continue;

    logger[level] = (...args) => {
      if (weight < minimumLevel) return;

      const { message, details } = normalizeBaileysLogArgs(args);
      writeLog('BAILEYS', level.toUpperCase(), message, details);
    };
  }

  return logger;
}

const AUTH_RESET_STATUS_CODES = new Set([
  DisconnectReason.loggedOut,
  DisconnectReason.badSession,
  DisconnectReason.multideviceMismatch,
  405,
]);

function parseBaileysVersion(value) {
  const parts = String(value || '')
    .split(/[.,\s]+/)
    .filter(Boolean)
    .map(Number);

  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }

  return parts;
}

async function resolveBaileysVersion() {
  const configuredVersion = parseBaileysVersion(process.env.BAILEYS_VERSION);
  if (configuredVersion) {
    console.log(
      `Usando versao do Baileys configurada no .env: ${configuredVersion.join('.')}`
    );
    return configuredVersion;
  }

  const latestWaWeb = await fetchLatestWaWebVersion();
  if (latestWaWeb?.version) {
    if (latestWaWeb.error) {
      console.warn(
        `Nao foi possivel buscar a versao mais recente do WhatsApp Web (${latestWaWeb.error.message || latestWaWeb.error}). Usando fallback do Baileys.`
      );
    }

    console.log(
      `Versao do WhatsApp Web usada pelo Baileys: ${latestWaWeb.version.join('.')}${latestWaWeb.isLatest ? '' : ' (fallback)'}`
    );
    return latestWaWeb.version;
  }

  const latestBaileys = await fetchLatestBaileysVersion();
  if (latestBaileys?.version) {
    console.log(
      `Versao do Baileys usada como fallback: ${latestBaileys.version.join('.')}`
    );
    return latestBaileys.version;
  }

  return undefined;
}

function shouldReconnect(statusCode) {
  return !AUTH_RESET_STATUS_CODES.has(Number(statusCode));
}

function loadLidMapping(lid) {
  if (!lid) return null;

  if (lidPhoneCache.has(lid)) {
    return lidPhoneCache.get(lid);
  }

  const mappingFile = path.join(authDirectory, `lid-mapping-${lid}_reverse.json`);

  if (!fs.existsSync(mappingFile)) {
    lidPhoneCache.set(lid, null);
    return null;
  }

  try {
    const raw = fs.readFileSync(mappingFile, 'utf8').trim();
    const parsed = JSON.parse(raw);
    const phone = UserService.normalizePhone(parsed);
    lidPhoneCache.set(lid, phone || null);
    return phone || null;
  } catch (error) {
    lidPhoneCache.set(lid, null);
    return null;
  }
}

function getPhoneFromMessage(msg) {
  const participant = msg.key?.participant;
  const remoteJid = msg.key?.remoteJid;

  const toValidPhone = (jid) => {
    if (!jid) return null;

    const jidString = String(jid);
    if (jidString.endsWith('@lid')) {
      const mappedPhone = loadLidMapping(jidString.split('@')[0]);
      if (mappedPhone && UserService.isValidPhone(mappedPhone)) {
        return mappedPhone;
      }
    }

    const phone = UserService.normalizePhone(jid);
    return UserService.isValidPhone(phone) ? phone : null;
  };

  const isGroupChat =
    String(remoteJid || '').endsWith('@g.us') ||
    String(remoteJid || '').endsWith('@broadcast');

  if (isGroupChat) {
    const participantPhone = toValidPhone(participant);
    if (participantPhone) return participantPhone;
  }

  return toValidPhone(remoteJid) || toValidPhone(participant);
}

function unwrapMessage(message) {
  let current = message;

  while (current) {
    const wrapped =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message;

    if (!wrapped) break;
    current = wrapped;
  }

  return current || {};
}

function extractIncomingContent(msg) {
  const message = unwrapMessage(msg.message);
  const image = message.imageMessage;
  const text =
    message.conversation ||
    message.extendedTextMessage?.text ||
    image?.caption ||
    message.videoMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    '';

  return {
    text: String(text).trim(),
    hasImage: Boolean(image),
    imageMimetype: image?.mimetype || null,
  };
}

async function initializeDatabase() {
  if (databaseInitialized) return;

  await Database.testConnection();
  await UserService.syncModel();
  await AtendimentoService.syncModel();
  await AgendamentoService.syncModel();
  await AnamneseService.syncModel();

  const Tratamento = require('./src/models/Tratamento');
  const Pagamento = require('./src/models/Pagamento');
  const ImagemClinica = require('./src/models/ImagemClinica');

  await Tratamento.sync();
  await Pagamento.sync();
  await ImagemClinica.sync();
  databaseInitialized = true;
  console.log('Banco MySQL conectado com sucesso');
}

function registerMessagingServices(sock) {
  reportDeliveryService.registerSocket(sock);

  MessageService.registerSender(async (to, message) => {
    const jid = String(to || '').includes('@')
      ? String(to)
      : `${String(to)}@s.whatsapp.net`;
    return sock.sendMessage(jid, message);
  });

  if (notificationsStarted) return;

  NotificationService.start({
    sendMessage: (to, message) => MessageService.send(to, message),
  });
  notificationsStarted = true;
}

async function startSock() {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Erro ao conectar no banco:', error.message);
    process.exit(1);
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDirectory);
  const version = await resolveBaileysVersion();
  const socketConfig = {
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    logger: createBaileysLogger(),
  };

  if (version) {
    socketConfig.version = version;
  }

  const sock = makeWASocket(socketConfig);

  registerMessagingServices(sock);

  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('WhatsApp conectado');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('Conexao fechada. Status:', statusCode);

      if (shouldReconnect(statusCode)) {
        setTimeout(() => {
          startSock().catch((error) => {
            console.error('Erro ao reconectar WhatsApp:', error.message);
          });
        }, 3000);
      } else {
        console.log(
          'Sessao do WhatsApp invalida ou registro recusado. Pare o bot, apague ou renomeie a pasta auth e conecte novamente pelo QR Code.'
        );
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const phone = getPhoneFromMessage(msg);
      const { text, hasImage, imageMimetype } = extractIncomingContent(msg);

      if (!text && !hasImage) continue;

      if (!phone) {
        await sock.sendMessage(from, {
          text: 'Nao consegui identificar um numero de telefone valido. Envie sua mensagem em conversa privada para continuarmos o atendimento.',
        });
        continue;
      }

      try {
        let media = null;

        if (hasImage) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            media = {
              buffer,
              mimetype: imageMimetype || 'image/jpeg',
            };
          } catch (error) {
            console.error('Erro ao baixar foto enviada pelo paciente:', error.message);
          }
        }

        incomingMessageBuffer.enqueue({
          conversationId: from,
          phone,
          message: text,
          hasImage,
          media,
        });
      } catch (error) {
        console.error('Erro ao preparar mensagem:', error.message);
        await sock.sendMessage(from, {
          text: 'Nao foi possivel processar sua mensagem agora. Tente novamente em instantes.',
        });
      }
    }
  });
}

startSock().catch((error) => {
  console.error('Erro ao iniciar o chatbot:', error.message);
});
