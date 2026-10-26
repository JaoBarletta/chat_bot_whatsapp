'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const AgendamentoFlow = require('../src/flows/AgendamentoFlow');
const TriagemFlow = require('../src/flows/TriagemFlow');
const ProcedureCatalog = require('../src/services/ProcedureCatalog');

function futureDate(daysAhead) {
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);
  return [
    String(future.getDate()).padStart(2, '0'),
    String(future.getMonth() + 1).padStart(2, '0'),
    future.getFullYear(),
  ].join('/');
}

test('AgendamentoFlow coleta necessidade de consulta de baixa complexidade sem anamnese', async () => {
  const appointments = [];
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment(data) {
        appointments.push(data);
        return data;
      },
    },
  });
  const context = {
    conversationId: 'patient-low-complexity',
    message: 'Quero fazer uma consulta',
    patient: { id: 10, nome: 'Joao', telefone: '5511999999999' },
  };

  let result = await flow.start(context);
  assert.match(result.reply, /necessidade|motivo/i);

  result = await flow.handle({ ...context, message: 'Avaliacao de rotina' });
  assert.match(ProcedureCatalog.normalize(result.reply), /data voce prefere/i);

  result = await flow.handle({ ...context, message: futureDate(7) });
  assert.match(
    ProcedureCatalog.normalize(result.reply),
    /horarios disponiveis/i
  );

  result = await flow.handle({ ...context, message: '15:00' });
  assert.match(result.reply, /confirmar/i);

  result = await flow.handle({ ...context, message: 'sim' });
  assert.equal(result.finished, true);
  assert.equal(appointments.length, 1);
  assert.equal(appointments[0].tipoProcedimento, 'Consulta');

  const observations = JSON.parse(appointments[0].anamnese);
  assert.equal(observations.complexidade, 'BAIXA');
  assert.equal(observations.anamnese_realizada, false);
  assert.equal(observations.necessidade_consulta, 'Avaliacao de rotina');
});

test('AgendamentoFlow responde disponibilidade sem tratar como data invalida', async () => {
  const availableDate = futureDate(2);
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment() {},
      async getNextAvailableDates() {
        return [{ date: availableDate, slots: ['08:00', '09:00'] }];
      },
      async getAvailableSlots() {
        return ['08:00', '09:00'];
      },
    },
  });
  const context = {
    conversationId: 'patient-availability',
    message: 'Quero fazer limpeza',
    patient: { id: 11, nome: 'Maria', telefone: '5511999999998' },
  };

  await flow.start(context);
  const result = await flow.handle({
    ...context,
    message: 'Que dias tem disponiveis?',
  });

  const normalizedReply = ProcedureCatalog.normalize(result.reply);
  assert.match(normalizedReply, /proximas datas/i);
  assert.match(result.reply, new RegExp(availableDate.replace(/\//g, '\\/')));
  assert.doesNotMatch(result.reply, /entender a data|data valida/i);
  assert.equal(flow.getState(context.conversationId).step, 'waiting_date');

  const dateResult = await flow.handle({
    ...context,
    message: availableDate.slice(0, 5),
  });

  assert.match(
    ProcedureCatalog.normalize(dateResult.reply),
    /horarios disponiveis/i
  );
  assert.equal(flow.getState(context.conversationId).date, availableDate);
  assert.equal(flow.getState(context.conversationId).step, 'waiting_time');
});

test('AgendamentoFlow entende datas, horarios e confirmacoes naturais', async () => {
  const appointments = [];
  const availableDate = futureDate(3);
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async getNextAvailableDates() {
        return [{ date: availableDate, slots: ['14:00', '15:00', '16:00'] }];
      },
      async getAvailableSlots() {
        return ['14:00', '15:00', '16:00'];
      },
      async createAppointment(data) {
        appointments.push(data);
        return { id: 50, duracao_min: 60 };
      },
    },
  });
  const context = {
    conversationId: 'patient-natural-schedule',
    message: 'Gostaria de fazer agendamento de uma limpeza de dente',
    patient: { id: 50, nome: 'Joao', telefone: '5511999999950' },
  };

  let result = await flow.start(context);
  assert.match(result.reply, /Limpeza/i);

  result = await flow.handle({
    ...context,
    message: 'quais datas tem disponiveis?',
  });
  assert.match(ProcedureCatalog.normalize(result.reply), /proximas datas/i);
  assert.doesNotMatch(
    ProcedureCatalog.normalize(result.reply),
    /entender a data/i
  );

  result = await flow.handle({ ...context, message: availableDate.slice(0, 5) });
  assert.match(ProcedureCatalog.normalize(result.reply), /horarios disponiveis/i);

  result = await flow.handle({ ...context, message: 'as 3 está bom' });
  assert.match(result.reply, /15:00/);
  assert.match(result.reply, /Limpeza/);

  result = await flow.handle({ ...context, message: 'certinho' });
  assert.equal(result.finished, true);
  assert.equal(appointments.length, 1);
  assert.equal(appointments[0].tipoProcedimento, 'Limpeza');
  assert.equal(result.appointment.procedure, 'Limpeza');
  assert.equal(result.reportData.appointmentDate, `${availableDate} às 15:00`);
});

test('AgendamentoFlow extrai data futura de uma frase completa', async () => {
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment() {},
    },
  });
  const context = {
    conversationId: 'patient-date-sentence',
    message: 'Quero fazer limpeza',
    patient: { id: 13, nome: 'Paulo', telefone: '5511999999996' },
  };
  const date = futureDate(15);

  await flow.start(context);
  const result = await flow.handle({
    ...context,
    message: `Gostaria de marcar para ${date}, se possível`,
  });

  assert.match(
    ProcedureCatalog.normalize(result.reply),
    /horarios disponiveis/i
  );
  assert.equal(flow.getState(context.conversationId).date, date);
  assert.equal(flow.getState(context.conversationId).step, 'waiting_time');
});

test('AgendamentoFlow informa quando a data encontrada na frase ja passou', async () => {
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment() {},
    },
  });
  const context = {
    conversationId: 'patient-past-date',
    message: 'Quero fazer limpeza',
    patient: { id: 14, nome: 'Paula', telefone: '5511999999995' },
  };

  await flow.start(context);
  const result = await flow.handle({
    ...context,
    message: 'Quero marcar para o dia 17/06/2025',
  });

  assert.match(ProcedureCatalog.normalize(result.reply), /data ja passou/i);
  assert.equal(flow.getState(context.conversationId).step, 'waiting_date');
});

test('AgendamentoFlow realiza anamnese para consulta de alta complexidade', async () => {
  const appointments = [];
  const anamneses = [];
  const flow = new AgendamentoFlow({
    agendamentoService: {
      async createAppointment(data) {
        appointments.push(data);
        return data;
      },
    },
    anamneseService: {
      async saveForPatient(data) {
        anamneses.push(data);
        return data;
      },
    },
  });
  const context = {
    conversationId: 'patient-high-complexity',
    message: 'Gostaria de agendar uma consulta',
    patient: { id: 12, nome: 'Carlos', telefone: '5511999999997' },
  };

  let result = await flow.start(context);
  assert.match(result.reply, /necessidade|motivo/i);

  result = await flow.handle({
    ...context,
    message: 'Quero avaliar para colocar implante',
  });
  assert.match(result.reply, /diabetes|hipertensao/i);
  assert.equal(flow.getState(context.conversationId).complexity, 'ALTA');

  result = await flow.handle({ ...context, message: 'Nao tenho' });
  assert.match(
    ProcedureCatalog.normalize(result.reply),
    /hipertensao|pressao alta/i
  );

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(result.reply, /cardiaco|cardiologista/i);

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(
    ProcedureCatalog.normalize(result.reply),
    /doenca sistemica|coagulacao/i
  );

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(ProcedureCatalog.normalize(result.reply), /transfusao/i);

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(result.reply, /transplante/i);

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(result.reply, /alergia/i);

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(result.reply, /anestesia/i);

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(
    ProcedureCatalog.normalize(result.reply),
    /outra informacao/i
  );

  result = await flow.handle({ ...context, message: 'Nao' });
  assert.match(result.reply, /data/i);

  result = await flow.handle({ ...context, message: futureDate(10) });
  assert.match(result.reply, /08:00/);

  result = await flow.handle({ ...context, message: '09:00' });
  assert.match(result.reply, /09:00/);

  result = await flow.handle({ ...context, message: 'está certo' });

  assert.equal(result.finished, true);
  assert.equal(appointments.length, 1);
  assert.equal(anamneses.length, 1);
  assert.equal(result.reportData.appointmentDate, `${futureDate(10)} às 09:00`);
  assert.equal(result.reportData.complexity, 'ALTA');
  assert.equal(anamneses[0].patientId, 12);
  assert.equal(anamneses[0].anamnesis.diabetes, false);
  assert.equal(anamneses[0].anamnesis.medicationAllergy, false);

  const observations = JSON.parse(appointments[0].anamnese);
  assert.equal(observations.complexidade, 'ALTA');
  assert.equal(observations.anamnese_realizada, true);
  assert.equal(observations.horario, '09:00');
  assert.equal(
    observations.necessidade_consulta,
    'Quero avaliar para colocar implante'
  );
});

test('TriagemFlow gera relatorio sem diagnostico e com foto opcional', async () => {
  const appointments = [];
  const flow = new TriagemFlow({
    agendamentoService: {
      async getAvailableSlots() {
        return ['09:00', '10:00'];
      },
      async createAppointment(data) {
        appointments.push(data);
        return data;
      },
    },
  });
  const context = {
    conversationId: 'patient-triage',
    message: 'Estou com dor no dente inferior esquerdo',
    patient: { nome: 'Joao Victor', telefone: '5511888888888' },
  };

  const startResult = await flow.start(context);
  assert.equal(
    startResult.reply,
    'Há quanto tempo você está sentindo essa dor ou incômodo?'
  );
  assert.equal(startResult.allowHumanization, false);
  await flow.handle({ ...context, message: '3 dias' });
  await flow.handle({ ...context, message: 'Regiao posterior' });
  await flow.handle({ ...context, message: 'Dor ao mastigar' });
  let result = await flow.handle({
    ...context,
    message: 'Não consigo enviar foto agora',
  });
  assert.match(result.reply, /qual data/i);

  result = await flow.handle({ ...context, message: futureDate(5) });
  assert.match(result.reply, /09:00/);

  result = await flow.handle({ ...context, message: '10:00' });
  assert.match(result.reply, /confirmar/i);

  result = await flow.handle({ ...context, message: 'certo' });

  assert.equal(result.finished, true);
  assert.equal(result.allowHumanization, false);
  assert.equal(appointments.length, 1);
  assert.match(result.report, /Paciente: Joao Victor/);
  assert.match(result.report, /Queixa principal: Estou com dor/);
  assert.match(result.report, /Foto: Nao enviada/);
  assert.match(result.report, /Complexidade: MEDIA/);
  assert.equal(result.reportData.complexity, 'MEDIA');
  assert.equal(
    result.reportData.appointmentDate,
    `${futureDate(5)} às 10:00`
  );
  assert.doesNotMatch(result.reply, /canal|cirurgia|extracao|implante/i);
});

test('TriagemFlow classifica dor muito forte como alta complexidade', async () => {
  const flow = new TriagemFlow({
    agendamentoService: {
      async createAppointment() {},
    },
  });
  const context = {
    conversationId: 'patient-high-symptom-complexity',
    message: 'Estou sentindo uma dor no dente muito forte',
    patient: {
      id: 40,
      nome: 'Joao',
      telefone: '5511888888888',
    },
  };

  const result = await flow.start(context);

  assert.equal(
    result.reply,
    'Há quanto tempo você está sentindo essa dor ou incômodo?'
  );
  assert.equal(
    flow.getState(context.conversationId).complexity,
    'ALTA'
  );
});

test('TriagemFlow preserva a foto para encaminhamento no relatorio', async () => {
  const flow = new TriagemFlow({
    agendamentoService: {
      async getAvailableSlots() {
        return ['08:00'];
      },
      async createAppointment() {},
    },
  });
  const photo = {
    buffer: Buffer.from('photo'),
    mimetype: 'image/jpeg',
  };
  const context = {
    conversationId: 'patient-photo',
    message: 'Estou com incomodo no dente',
    patient: { nome: 'Ana', telefone: '5511777777777' },
  };

  await flow.start(context);
  await flow.handle({ ...context, message: '1 dia' });
  await flow.handle({ ...context, message: 'Dente do fundo' });
  await flow.handle({ ...context, message: 'Ao mastigar' });
  let result = await flow.handle({
    ...context,
    message: '',
    hasImage: true,
    media: photo,
  });

  assert.equal(result.finished, false);
  assert.equal(flow.getState(context.conversationId).photo, photo);

  await flow.handle({ ...context, message: futureDate(6) });
  await flow.handle({ ...context, message: '08:00' });
  result = await flow.handle({ ...context, message: 'sim' });

  assert.equal(result.finished, true);
  assert.equal(result.reportData.photo, photo);
  assert.equal(result.reportData.photoReceived, true);
  assert.equal(
    result.reportData.appointmentDate,
    `${futureDate(6)} às 08:00`
  );
});

test('TriagemFlow aceita recusas naturais de envio de foto', async () => {
  const refusals = [
    'Não consigo tirar foto',
    'Não posso tirar uma foto agora',
    'Não tenho como enviar imagem',
    'Prefiro não enviar foto',
    'Minha câmera não funciona',
    'Não consigo',
  ];

  for (const [index, refusal] of refusals.entries()) {
    const flow = new TriagemFlow({
      agendamentoService: {
        async createAppointment() {},
      },
    });
    const context = {
      conversationId: `patient-photo-refusal-${index}`,
      message: 'Estou com sensibilidade no dente',
      patient: {
        id: index + 20,
        nome: 'Paciente',
        telefone: `55119999999${index}`,
      },
    };

    await flow.start(context);
    await flow.handle({ ...context, message: '2 dias' });
    await flow.handle({ ...context, message: 'Dente da frente' });
    await flow.handle({ ...context, message: 'Quando tomo algo gelado' });
    const result = await flow.handle({ ...context, message: refusal });

    assert.match(result.reply, /qual data/i);
    assert.equal(
      flow.getState(context.conversationId).step,
      'waiting_date'
    );
    assert.equal(
      flow.getState(context.conversationId).photoReceived,
      false
    );
  }
});

test('TriagemFlow aceita data curta depois de apresentar disponibilidade', async () => {
  const availableDate = futureDate(4);
  const flow = new TriagemFlow({
    agendamentoService: {
      async getNextAvailableDates() {
        return [{ date: availableDate, slots: ['10:00'] }];
      },
      async getAvailableSlots() {
        return ['10:00'];
      },
    },
  });
  const context = {
    conversationId: 'patient-triage-short-date',
    message: 'Estou com sensibilidade no dente',
    patient: {
      id: 31,
      nome: 'Paciente',
      telefone: '5511999999931',
    },
  };

  await flow.start(context);
  await flow.handle({ ...context, message: '2 dias' });
  await flow.handle({ ...context, message: 'Dente da frente' });
  await flow.handle({ ...context, message: 'Quando tomo algo gelado' });
  await flow.handle({ ...context, message: 'Nao consigo tirar foto' });

  const availabilityResult = await flow.handle({
    ...context,
    message: 'Quais dias estao disponiveis?',
  });
  assert.match(
    ProcedureCatalog.normalize(availabilityResult.reply),
    /proximas datas/i
  );

  const dateResult = await flow.handle({
    ...context,
    message: availableDate.slice(0, 5),
  });

  assert.match(
    ProcedureCatalog.normalize(dateResult.reply),
    /horarios disponiveis/i
  );
  assert.equal(flow.getState(context.conversationId).date, availableDate);
  assert.equal(
    flow.getState(context.conversationId).step,
    'waiting_time_slot'
  );
});
