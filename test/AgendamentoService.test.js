'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Agendamento = require('../src/models/Agendamento');
const AgendamentoService = require('../src/services/AgendamentoService');

test('calcula horarios livres usando as consultas ocupadas no banco', async () => {
  const originalFindAll = Agendamento.findAll;
  const originalOpenHour = process.env.APPOINTMENT_OPEN_HOUR;
  const originalCloseHour = process.env.APPOINTMENT_CLOSE_HOUR;
  const originalSlotMinutes = process.env.APPOINTMENT_SLOT_MINUTES;
  const date = new Date();
  date.setDate(date.getDate() + 10);
  date.setHours(0, 0, 0, 0);

  const occupiedStart = new Date(date);
  occupiedStart.setHours(10, 0, 0, 0);

  process.env.APPOINTMENT_OPEN_HOUR = '8';
  process.env.APPOINTMENT_CLOSE_HOUR = '20';
  process.env.APPOINTMENT_SLOT_MINUTES = '60';
  Agendamento.findAll = async () => [
    {
      data_hora: occupiedStart,
      duracao_min: 120,
      status: 'confirmada',
    },
  ];

  try {
    const slots = await AgendamentoService.getAvailableSlots(date);

    assert.equal(slots[0], '08:00');
    assert.ok(slots.includes('09:00'));
    assert.ok(!slots.includes('10:00'));
    assert.ok(!slots.includes('11:00'));
    assert.ok(slots.includes('12:00'));
    assert.equal(slots.at(-1), '19:00');
  } finally {
    Agendamento.findAll = originalFindAll;
    restoreEnv('APPOINTMENT_OPEN_HOUR', originalOpenHour);
    restoreEnv('APPOINTMENT_CLOSE_HOUR', originalCloseHour);
    restoreEnv('APPOINTMENT_SLOT_MINUTES', originalSlotMinutes);
  }
});

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test('salva duracao ofertada, paciente e observacoes e recusa horario ocupado', async (t) => {
  let saved;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(Agendamento.sequelize, 'transaction', async (_options, action) => action(transaction));
  t.mock.method(AgendamentoService, 'isSlotAvailable', async () => true);
  t.mock.method(AgendamentoService, 'getScheduleConfig', () => ({ slotMinutes: 30 }));
  t.mock.method(Agendamento, 'create', async (data) => { saved = data; return data; });
  await AgendamentoService.createAppointment({ idUsuario: 7, dataHorario: new Date(2030, 1, 1, 10), anamnese: '{"procedimento":"Limpeza"}' });
  assert.equal(saved.duracao_min, 30);
  assert.equal(saved.paciente_id, 7);
  assert.equal(saved.status, 'pendente');
  assert.equal(JSON.parse(saved.observacoes).procedimento, 'Limpeza');
  AgendamentoService.isSlotAvailable.mock.mockImplementation(async () => false);
  await assert.rejects(AgendamentoService.createAppointment({ dataHorario: new Date() }), { code: 'SLOT_UNAVAILABLE' });
  assert.equal(Agendamento.create.mock.callCount(), 1);
});
