'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Anamnese = require('../src/models/Anamnese');
const AnamneseService = require('../src/services/AnamneseService');

test('mapeia e atualiza a anamnese odontologica do paciente', async () => {
  const originalFindOne = Anamnese.findOne;
  const originalCreate = Anamnese.create;
  let updatedPayload;
  const existing = {
    async update(payload) {
      updatedPayload = payload;
    },
  };

  Anamnese.findOne = async () => existing;
  Anamnese.create = async () => {
    throw new Error('Nao deveria criar um novo registro.');
  };

  try {
    const result = await AnamneseService.saveForPatient({
      patientId: 7,
      anamnesis: {
        diabetes: true,
        hypertension: false,
        heartProblems: true,
        systemicDiseases: 'Asma',
        bloodTransfusion: false,
        transplant: false,
        medicationAllergy: true,
        allergicMedications: 'Dipirona',
        anestheticObservations: 'Taquicardia em atendimento anterior',
        otherConditions: 'Uso de anticoagulante',
      },
    });

    assert.equal(result, existing);
    assert.equal(updatedPayload.paciente_id, 7);
    assert.equal(updatedPayload.diabetes, true);
    assert.equal(updatedPayload.problemas_cardiacos, true);
    assert.equal(updatedPayload.hipertensao, false);
    assert.equal(updatedPayload.doencas_sistemicas, 'Asma');
    assert.equal(updatedPayload.alergia_medicamentos, true);
    assert.equal(updatedPayload.medicamentos_alergicos, 'Dipirona');
    assert.equal(
      updatedPayload.observacoes_anestesico,
      'Taquicardia em atendimento anterior'
    );
  } finally {
    Anamnese.findOne = originalFindOne;
    Anamnese.create = originalCreate;
  }
});
