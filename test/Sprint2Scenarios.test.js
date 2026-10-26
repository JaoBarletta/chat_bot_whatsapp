'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { replay } = require('../scripts/lib/sprint_scenarios');
const TriagemFlow = require('../src/flows/TriagemFlow');
const AgendamentoFlow = require('../src/flows/AgendamentoFlow');
const MessageHandler = require('../src/handlers/MessageHandler');

for (const type of ['limpeza', 'triagem', 'implante', 'pendente']) {
  test(`atendimento completo simulado: ${type}`, async () => {
    const result = await replay({ type });
    assert.equal(result.calendarEvents, type === 'pendente' ? 0 : 1);
    assert.equal(result.history, result.messages);
  });
}

test('triagem preserva contexto de pacientes intercalados e nao confirma uma negativa', async () => {
  let writes = 0;
  const flow = new TriagemFlow({ agendamentoService: { async createAppointment() { writes++; } } });
  const a = { conversationId: 'a', message: 'Dor no dente', patient: { id: 1 } };
  const b = { conversationId: 'b', message: 'Sensibilidade', patient: { id: 2 } };
  await flow.start(a);
  await flow.start(b);
  await flow.handle({ ...a, message: '3 dias' });
  await flow.handle({ ...b, message: '1 semana' });
  assert.equal(flow.getState('a').symptomTime, '3 dias');
  assert.equal(flow.getState('b').symptomTime, '1 semana');
  Object.assign(flow.getState('a'), { step: 'waiting_confirmation', date: '20/12/2030', time: '15:00' });
  const result = await flow.handle({ ...a, message: 'Nao esta certo, quero outro horario' });
  assert.equal(result.finished, false);
  assert.equal(writes, 0);
  assert.equal(flow.getState('a').step, 'waiting_date');
  assert.equal(flow.getState('b').step, 'waiting_location');
});

test('foto antecipada nao pula pergunta obrigatoria da triagem', async () => {
  const flow = new TriagemFlow({ agendamentoService: {} });
  const context = { conversationId: 'photo', message: 'dor' };
  await flow.start(context);
  const photo = { buffer: Buffer.from('synthetic') };
  await flow.handle({ ...context, message: '', hasImage: true, media: photo });
  assert.equal(flow.getState('photo').step, 'waiting_time');
  assert.equal(flow.getState('photo').symptomTime, null);
  assert.equal(flow.getState('photo').photo, photo);
});

test('resposta clinica durante anamnese nao reinicia triagem nem perde historico', async () => {
  const flow = new AgendamentoFlow({ agendamentoService: {}, anamneseService: {} });
  const handler = new MessageHandler({
    sendMessage: async () => {},
    userService: { async findByPhone() { return { id: 1, nome: 'Teste' }; } },
    atendimentoService: { async saveHistory() {} },
    responseHumanizer: { async humanize({ baseReply }) { return baseReply; } },
    flows: new Map([['AGENDAMENTO', flow], ['SINTOMA', new TriagemFlow({ agendamentoService: {} })]]),
  });
  for (const message of ['Quero agendar implante', 'Nao', 'Nao', 'Nao', 'Tenho dor cronica nas costas']) {
    await handler.handle({ conversationId: 'anamnese', phone: 'test', message });
  }
  assert.equal(handler.activeFlows.get('anamnese'), 'AGENDAMENTO');
  assert.equal(flow.getState('anamnese').anamnesis.diabetes, false);
  assert.equal(flow.getState('anamnese').step, 'waiting_anamnesis_systemic_details');
  assert.equal(handler.conversationHistory.get('anamnese').length, 8);
});
