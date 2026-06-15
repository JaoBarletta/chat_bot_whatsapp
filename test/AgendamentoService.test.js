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
