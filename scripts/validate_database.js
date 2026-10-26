'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Transaction } = require('sequelize');
const Database = require('../src/database/connection');
const Usuario = require('../src/models/Usuario');
const Agendamento = require('../src/models/Agendamento');
const Anamnese = require('../src/models/Anamnese');
const AgendamentoService = require('../src/services/AgendamentoService');
const AnamneseService = require('../src/services/AnamneseService');

async function main() {
  const db = Database.getInstance();
  let transaction;
  const phone = `TEST-${randomUUID().slice(0, 14)}`;
  try {
    await db.authenticate();
    const [tables] = await db.query("SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('pacientes','consultas','anamnese')");
    assert.equal(tables.length, 3, 'Tabelas necessarias ausentes');
    assert.ok(tables.every((row) => row.ENGINE === 'InnoDB'), 'Teste exige InnoDB para rollback');
    transaction = await db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
    const patient = await Usuario.create({ nome: 'TESTE AUTOMATIZADO SPRINT 2', telefone: phone }, { transaction });
    const date = new Date();
    date.setDate(date.getDate() + 60);
    const slots = await AgendamentoService.getAvailableSlots(date, { transaction });
    assert.ok(slots.length, 'Nenhum horario livre para o teste isolado');
    const [hours, minutes] = slots[0].split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    const observations = JSON.stringify({ procedimento: 'Limpeza', teste: 'sprint2' });
    const appointment = await AgendamentoService.createAppointment({ idUsuario: patient.id, dataHorario: date, anamnese: observations }, { transaction });
    const stored = await Agendamento.findByPk(appointment.id, { transaction });
    assert.equal(Number(stored.paciente_id), Number(patient.id));
    assert.equal(stored.status, 'pendente');
    assert.equal(stored.data_hora.getTime(), date.getTime());
    assert.equal(stored.duracao_min, AgendamentoService.getScheduleConfig().slotMinutes);
    assert.equal(JSON.parse(stored.observacoes).procedimento, 'Limpeza');
    await assert.rejects(AgendamentoService.createAppointment({ idUsuario: patient.id, dataHorario: date }, { transaction }), { code: 'SLOT_UNAVAILABLE' });
    const row = await AnamneseService.saveForPatient({ patientId: patient.id, anamnesis: { diabetes: true, medicationAllergy: true, allergicMedications: 'DADO SINTETICO' } }, { transaction });
    const anamnesis = await Anamnese.findByPk(row.id, { transaction });
    assert.equal(Boolean(anamnesis.diabetes), true);
    assert.equal(anamnesis.medicamentos_alergicos, 'DADO SINTETICO');
    await transaction.rollback();
    transaction = null;
    assert.equal(await Usuario.count({ where: { telefone: phone } }), 0);
    console.log('PASS: consulta, duracao, conflito, anamnese e rollback validados no MySQL. Nenhum paciente de teste mantido.');
  } finally {
    if (transaction && !transaction.finished) await transaction.rollback();
    await db.close();
  }
}

main().catch((error) => {
  const code = String(error.original?.code || error.parent?.code || '').replace(/[^A-Z0-9_]/g, '');
  console.error(`Validacao MySQL nao concluida: ${error.name} ${code}. Nenhuma credencial ou registro clinico sera impresso.`);
  process.exitCode = 1;
});
