'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ProcedureComplexityService = require('../src/services/ProcedureComplexityService');

test('classifica necessidades em baixa, media e alta complexidade', () => {
  assert.equal(
    ProcedureComplexityService.classify({
      procedure: 'Consulta',
      need: 'Avaliacao de rotina',
    }),
    'BAIXA'
  );
  assert.equal(
    ProcedureComplexityService.classify({
      procedure: 'Consulta',
      need: 'Quero avaliar um clareamento',
    }),
    'MEDIA'
  );
  assert.equal(
    ProcedureComplexityService.classify({
      procedure: 'Consulta',
      need: 'Quero avaliar para colocar implante',
    }),
    'ALTA'
  );
});

test('exige anamnese somente para alta complexidade', () => {
  assert.equal(ProcedureComplexityService.requiresAnamnesis('BAIXA'), false);
  assert.equal(ProcedureComplexityService.requiresAnamnesis('MEDIA'), false);
  assert.equal(ProcedureComplexityService.requiresAnamnesis('ALTA'), true);
});
