'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PatientReportService = require('../src/services/PatientReportService');

test('monta relatorio de triagem com data pendente', () => {
  const report = PatientReportService.build({
    patient: {
      nome: 'Joao Victor',
      telefone: '554196950668',
    },
    intent: 'SINTOMA',
    data: {
      complaint: 'Dor no dente',
      complexity: 'MEDIA',
      characteristics: {
        symptomTime: '2 dias',
        location: 'Dente do fundo',
        description: 'Dor constante',
        complexity: 'MEDIA',
      },
      photoReceived: true,
    },
  });

  assert.match(report, /Nome: Joao Victor/);
  assert.match(report, /Telefone: 554196950668/);
  assert.match(report, /Queixa principal: Dor no dente/);
  assert.match(report, /Tempo do sintoma: 2 dias/);
  assert.match(report, /Foto: Enviada/);
  assert.match(report, /\*COMPLEXIDADE: MEDIA\*/);
  assert.match(report, /\*NECESSIDADE: AVALIAÇÃO ODONTOLÓGICA/);
  assert.match(report, /Data e horário: Pendente/);
  assert.match(report, /Status: Pendente de definição/);
});

test('monta relatorio de agendamento com anamnese e data', () => {
  const report = PatientReportService.build({
    patient: {
      nome: 'Maria',
      telefone: '5511999999999',
    },
    intent: 'AGENDAMENTO',
    data: {
      complaint: 'Avaliacao para implante',
      need: 'Colocar implante',
      procedure: 'Implante',
      complexity: 'ALTA',
      anamnesis: {
        healthConditions: 'Hipertensao controlada',
        continuousMedication: 'Losartana',
        allergies: 'Nao',
        transfusionOrTransplant: 'Nao',
      },
      appointmentDate: '20/06/2026',
    },
  });

  assert.match(report, /\*NECESSIDADE: COLOCAR IMPLANTE\*/);
  assert.match(report, /\*COMPLEXIDADE: ALTA\*/);
  assert.match(report, /Complexidade: ALTA/);
  assert.match(report, /Condições de saúde: Hipertensao controlada/);
  assert.match(report, /Medicamento contínuo: Losartana/);
  assert.match(report, /Data e horário: 20\/06\/2026/);
});

test('monta relatorio com anamnese odontologica estruturada', () => {
  const report = PatientReportService.build({
    patient: {
      nome: 'Carlos',
      telefone: '5511888888888',
    },
    intent: 'AGENDAMENTO',
    data: {
      procedure: 'Implante',
      complexity: 'ALTA',
      anamnesis: {
        diabetes: false,
        hypertension: true,
        heartProblems: false,
        systemicDiseases: 'Asma',
        bloodTransfusion: false,
        transplant: false,
        medicationAllergy: true,
        allergicMedications: 'Dipirona',
        anestheticObservations: null,
        otherConditions: null,
      },
      appointmentDate: '20/06/2026 às 09:00',
    },
  });

  assert.match(report, /Diabetes: Não/);
  assert.match(report, /Hipertensão: Sim/);
  assert.match(report, /Doenças sistêmicas: Asma/);
  assert.match(report, /Medicamentos alérgicos: Dipirona/);
  assert.match(report, /20\/06\/2026 às 09:00/);
});
