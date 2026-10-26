'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const AIDataPolicyService = require('../src/services/AIDataPolicyService');

test('AIDataPolicyService minimiza dados enviados ao modelo', () => {
  const safeContext = AIDataPolicyService.prepareHumanizationContext({
    patientName: 'Joao Victor Barletta da Silva',
    patientMessage:
      'Meu CPF é 123.456.789-10, telefone 554196950668, email joao@email.com e data de nascimento 10/05/2000.',
    recentHistory: [
      {
        role: 'patient',
        content: 'Meu telefone novo é (41) 96950-6688',
      },
      {
        role: 'assistant',
        content: 'Pode me mandar seu e-mail?',
      },
    ],
  });

  assert.equal(safeContext.patientName, 'Joao');
  assert.doesNotMatch(safeContext.patientMessage, /123\.456\.789-10/);
  assert.doesNotMatch(safeContext.patientMessage, /554196950668/);
  assert.doesNotMatch(safeContext.patientMessage, /joao@email\.com/);
  assert.doesNotMatch(safeContext.patientMessage, /10\/05\/2000/);
  assert.match(safeContext.patientMessage, /\[CPF_REMOVIDO\]/);
  assert.match(safeContext.patientMessage, /\[TELEFONE_REMOVIDO\]/);
  assert.match(safeContext.patientMessage, /\[EMAIL_REMOVIDO\]/);
  assert.match(safeContext.patientMessage, /\[DATA_REMOVIDA\]/);
  assert.doesNotMatch(safeContext.recentHistory[0].content, /96950-6688/);
  assert.equal(safeContext.recentHistory[1].role, 'assistant');
});

test('AIDataPolicyService documenta politica de dados para auditoria', () => {
  const summary = AIDataPolicyService.getPolicySummary();

  assert.equal(summary.policy, process.env.OPENAI_DATA_POLICY || 'lgpd_minimal');
  assert.ok(summary.allowed.some((item) => /primeiro nome/i.test(item)));
  assert.ok(summary.blocked.includes('CPF'));
  assert.ok(summary.blocked.includes('fotos e arquivos clinicos'));
});
