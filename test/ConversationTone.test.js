'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const OutroFlow = require('../src/flows/OutroFlow');
const AgendamentoFlow = require('../src/flows/AgendamentoFlow');

test('saudacao usa primeiro nome e nao exibe menu de categorias', async () => {
  const flow = new OutroFlow();
  const result = await flow.start({
    conversationId: 'patient-1',
    message: 'Oi',
    patient: { nome: 'Joao Victor Barletta da Silva' },
  });

  assert.match(result.reply, /Oi, Joao/i);
  assert.match(result.reply, /O que você precisa|Como posso te ajudar/i);
  assert.doesNotMatch(result.reply, /financeiro|historico|atendimento humano/i);
});

test('saudacao composta continua natural e deterministica', async () => {
  const flow = new OutroFlow();
  const result = await flow.start({
    conversationId: 'patient-composed-greeting',
    message: 'Olá, boa tarde tudo bem?',
    patient: { nome: 'Maria Silva' },
  });

  assert.match(result.reply, /Oi, Maria/i);
  assert.match(result.reply, /O que você precisa|Como posso te ajudar/i);
  assert.notEqual(result.allowHumanization, false);
  assert.equal(result.reportable, false);
});

test('agendamento generico pergunta o procedimento sem repetir o nome', async () => {
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment() {},
    },
  });

  const result = await flow.start({
    conversationId: 'patient-2',
    message: 'Gostaria de fazer um agendamento',
    patient: { nome: 'Joao Victor' },
  });

  assert.match(result.reply, /qual procedimento/i);
  assert.doesNotMatch(result.reply, /Joao/i);
  assert.doesNotMatch(result.reply, /informe|selecione|opcoes/i);
});

test('agendamento reconhece procedimento com erro simples de digitacao', async () => {
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment() {},
    },
  });

  const result = await flow.start({
    conversationId: 'patient-typo',
    message: 'Quero agendar uma linpeza',
    patient: { nome: 'Joao Victor' },
  });

  assert.match(result.reply, /Limpeza/i);
  assert.match(result.reply, /data/i);
  assert.equal(flow.getState('patient-typo').procedure, 'Limpeza');
});
