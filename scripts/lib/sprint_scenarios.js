'use strict';

const path = require('node:path');
const assert = require('node:assert/strict');

// The same replay is used by regression tests and the offline benchmark.
async function replay({ load = (name) => require(path.resolve(__dirname, '../..', name)), type = 'limpeza', id = 'test', mode = 'smart' } = {}) {
  const Handler = load('src/handlers/MessageHandler');
  const AgendamentoFlow = load('src/flows/AgendamentoFlow');
  const TriagemFlow = load('src/flows/TriagemFlow');
  const OutroFlow = load('src/flows/OutroFlow');
  const Humanizer = load('src/services/ResponseHumanizerService');
  const appointments = [], reports = [], events = [], history = [], anamneses = [];
  let aiCalls = 0;
  const simulatedAI = { async humanizeReply({ baseReply }) { aiCalls++; return baseReply; } };
  const scheduling = {
    async getAvailableSlots() { return ['14:00', '15:00']; },
    async createAppointment(data) { appointments.push(data); return { id: appointments.length, duracao_min: 60 }; },
  };
  const handler = new Handler({
    sendMessage: async () => {},
    userService: { async findByPhone() { return { id: 1, nome: 'Paciente Teste', telefone: '5500000000000', email: 'test@example.com' }; } },
    atendimentoService: { async saveHistory(data) { history.push(data); } },
    responseHumanizer: new Humanizer({ mode, aiService: simulatedAI, ollamaService: simulatedAI }),
    calendarService: { async createAppointmentEvent(data) { events.push(data); return { created: false, status: 'simulated' }; } },
    flows: new Map([
      ['AGENDAMENTO', new AgendamentoFlow({ agendamentoService: scheduling, anamneseService: { async saveForPatient(data) { anamneses.push(data); } } })],
      ['SINTOMA', new TriagemFlow({ agendamentoService: scheduling })],
      ['OUTRO', new OutroFlow()],
    ]),
    onAttendanceCompleted: async (data) => reports.push(data),
  });
  const date = new Date();
  date.setDate(date.getDate() + 10);
  const dateText = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  const scripts = {
    limpeza: ['Ola tudo bem?', 'Quero agendar limpeza', dateText, 'as 15h', 'certinho'],
    triagem: ['Estou com dor no dente', '3 dias', 'Dente do fundo', 'Ao mastigar', 'Nao consigo tirar foto', dateText, '15:00', 'certo'],
    implante: ['Quero agendar implante', ...Array(9).fill('Nao'), dateText, '15:00', 'sim'],
    pendente: ['Estou com dor no dente', '3 dias', 'Dente do fundo', 'Ao mastigar', 'Nao consigo tirar foto', 'decido depois'],
  };
  for (const message of scripts[type]) await handler.handle({ conversationId: id, phone: '5500000000000', message });
  assert.equal(handler.activeFlows.size, 0, 'atendimento deve encerrar');
  assert.equal(reports.length, 1, 'um relatorio por atendimento');
  assert.equal(appointments.length, type === 'pendente' ? 0 : 1, 'persistencia do agendamento');
  if (type === 'limpeza') assert.equal(appointments[0].tipoProcedimento.toLowerCase(), 'limpeza');
  if (type === 'implante') assert.equal(anamneses.length, 1, 'persistencia da anamnese');
  return { messages: scripts[type].length, aiCalls, appointments: appointments.length, reports: reports.length, calendarEvents: events.length, history: history.length };
}

module.exports = { replay };
