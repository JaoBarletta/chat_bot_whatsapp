'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const MessageHandler = require('../src/handlers/MessageHandler');
const IntentTypes = require('../src/constants/IntentTypes');
const FlowRouter = require('../src/services/FlowRouter');
const OutroFlow = require('../src/flows/OutroFlow');

test('MessageHandler envia relatorio ao encerrar qualquer atendimento reconhecido', async () => {
  const reports = [];
  const patient = {
    id: 1,
    nome: 'Joao Victor',
    telefone: '554196950668',
  };
  const finishedFlow = {
    intent: IntentTypes.FINANCEIRO,
    async start() {
      return {
        intent: IntentTypes.FINANCEIRO,
        finished: true,
        reportable: true,
        reply: 'Vou encaminhar para a equipe.',
      };
    },
  };

  const handler = new MessageHandler({
    sendMessage: async () => {},
    router: {
      async route() {
        return IntentTypes.FINANCEIRO;
      },
    },
    userService: {
      async findByPhone() {
        return patient;
      },
    },
    atendimentoService: {
      async saveHistory() {},
    },
    responseHumanizer: {
      async humanize({ baseReply }) {
        return baseReply;
      },
    },
    flows: new Map([[IntentTypes.FINANCEIRO, finishedFlow]]),
    onAttendanceCompleted: async (payload) => reports.push(payload),
  });

  await handler.handle({
    conversationId: 'chat-report',
    phone: patient.telefone,
    message: 'Quanto custa?',
  });

  assert.equal(reports.length, 1);
  assert.match(reports[0].report, /Nome: Joao Victor/);
  assert.match(reports[0].report, /Mensagem: Quanto custa\?/);
  assert.match(reports[0].report, /Data do agendamento: Pendente/);
});

test('MessageHandler nao envia relatorio para uma simples saudacao', async () => {
  let reports = 0;
  let humanizerCalls = 0;
  const handler = new MessageHandler({
    sendMessage: async () => {},
    router: new FlowRouter(),
    userService: {
      async findByPhone() {
        return {
          id: 2,
          nome: 'Maria',
          telefone: '5511999999999',
        };
      },
    },
    atendimentoService: {
      async saveHistory() {},
    },
    responseHumanizer: {
      async humanize({ baseReply }) {
        humanizerCalls += 1;
        return baseReply;
      },
    },
    flows: new Map([[IntentTypes.OUTRO, new OutroFlow()]]),
    onAttendanceCompleted: async () => {
      reports += 1;
    },
  });

  await handler.handle({
    conversationId: 'chat-greeting',
    phone: '5511999999999',
    message: 'Olá, boa tarde tudo bem?',
  });

  assert.equal(reports, 0);
  assert.equal(humanizerCalls, 1);
});

test('MessageHandler exige marcacao explicita antes de gerar relatorio', async () => {
  let reports = 0;
  const handler = new MessageHandler({
    sendMessage: async () => {},
    router: {
      async route() {
        return IntentTypes.DUVIDA;
      },
    },
    userService: {
      async findByPhone() {
        return {
          id: 3,
          nome: 'Pedro',
          telefone: '5511888888888',
        };
      },
    },
    atendimentoService: {
      async saveHistory() {},
    },
    responseHumanizer: {
      async humanize({ baseReply }) {
        return baseReply;
      },
    },
    flows: new Map([
      [
        IntentTypes.DUVIDA,
        {
          intent: IntentTypes.DUVIDA,
          async start() {
            return {
              intent: IntentTypes.DUVIDA,
              finished: true,
              reply: 'Pode me explicar melhor?',
            };
          },
        },
      ],
    ]),
    onAttendanceCompleted: async () => {
      reports += 1;
    },
  });

  await handler.handle({
    conversationId: 'chat-without-report-marker',
    phone: '5511888888888',
    message: 'Mensagem ambigua',
  });

  assert.equal(reports, 0);
});
