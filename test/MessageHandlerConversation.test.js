'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const MessageHandler = require('../src/handlers/MessageHandler');
const IntentTypes = require('../src/constants/IntentTypes');
const AgendamentoFlow = require('../src/flows/AgendamentoFlow');
const TriagemFlow = require('../src/flows/TriagemFlow');
const OutroFlow = require('../src/flows/OutroFlow');

test('conversa muda naturalmente de agendamento para triagem quando surge dor', async () => {
  const sentMessages = [];
  const patient = {
    id: 1,
    nome: 'Joao Victor Barletta da Silva',
    telefone: '5511999999999',
  };

  const handler = new MessageHandler({
    sendMessage: async (_to, message) => sentMessages.push(message.text),
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
    flows: new Map([
      [
        IntentTypes.AGENDAMENTO,
        new AgendamentoFlow({
          agendamentoService: {
            async createAppointment() {},
          },
        }),
      ],
      [IntentTypes.SINTOMA, new TriagemFlow()],
      [IntentTypes.OUTRO, new OutroFlow()],
    ]),
  });

  await handler.handle({
    conversationId: 'chat-1',
    phone: patient.telefone,
    message: 'Gostaria de fazer um agendamento',
  });

  await handler.handle({
    conversationId: 'chat-1',
    phone: patient.telefone,
    message: 'É uma consulta, estou com dor de dente',
  });

  assert.match(sentMessages[0], /qual procedimento/i);
  assert.doesNotMatch(sentMessages[0], /Joao/i);
  assert.match(sentMessages[1], /Há quanto tempo/i);
  assert.doesNotMatch(sentMessages[1], /Sinto muito|Entendi/i);
  assert.doesNotMatch(sentMessages[1], /Qual data|agendar consulta/i);
  assert.equal(handler.activeFlows.get('chat-1'), IntentTypes.SINTOMA);
});
