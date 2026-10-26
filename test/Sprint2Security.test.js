'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const OpenAIService = require('../src/services/OpenAIService');
const Humanizer = require('../src/services/ResponseHumanizerService');

test('humanizador bloqueia recomendacoes, diagnostico, deboche e alteracoes de contrato', async () => {
  const baseReply = 'Qual data voce prefere?';
  const candidates = [
    'Recomendo ibuprofeno. Qual data voce prefere?',
    'Voce tem carie. Qual data voce prefere?',
    'E uma infeccao. Qual data voce prefere?',
    'Faca bochecho com sal. Qual data voce prefere?',
    'Hahaha! Qual data voce prefere?',
    'Seu implante esta confirmado. Qual data voce prefere?',
    'Qual data voce prefere? E qual seu CPF?',
    'Paciente: nao\nAtendente: Qual data voce prefere?',
  ];
  for (const candidate of candidates) {
    const humanizer = new Humanizer({ mode: 'always', aiService: { async humanizeReply() { return candidate; } } });
    assert.equal(await humanizer.humanize({ baseReply, intent: 'DUVIDA' }), baseReply, candidate);
  }
});

test('texto aprovado com identificadores fica local e contexto enviado tem tamanho limitado', async () => {
  let calls = 0;
  const humanizer = new Humanizer({ mode: 'always', aiService: { async humanizeReply() { calls++; } } });
  const baseReply = 'Seu email e paciente@example.com. Esta correto?';
  assert.equal(await humanizer.humanize({ baseReply }), baseReply);
  assert.equal(calls, 0);
  const request = OpenAIService.buildHumanizationRequest({
    config: { historyLimit: 999 }, baseReply: 'Qual dia prefere?',
    patientName: 'Ana Silva', patientMessage: 'x'.repeat(20000),
    recentHistory: Array.from({ length: 100 }, () => ({ role: 'patient', content: 'y'.repeat(10000) })),
  });
  assert.ok(request.input.length < 2000);
  assert.equal(request.store, false);
  assert.match(request.instructions, /dados nao confiaveis/);
});

test('resposta incompleta e falha HTTP usam fallback e cooldown', async (t) => {
  t.mock.method(OpenAIService, 'getConfig', () => ({ apiKey: 'test', baseUrl: 'https://example.invalid', model: 'test', timeoutMs: 100, retryCooldownMs: 60000 }));
  const usage = require('../src/services/AIUsageService');
  const records = [];
  t.mock.method(usage, 'record', async (row) => records.push(row));
  const fetchMock = t.mock.method(global, 'fetch', async () => ({ ok: true, json: async () => ({ status: 'incomplete', output_text: 'Qual dia', usage: { total_tokens: 12 } }) }));
  const humanizer = new Humanizer({ mode: 'always' });
  OpenAIService.resetAvailability();
  t.after(() => OpenAIService.resetAvailability());
  assert.equal(await humanizer.humanize({ baseReply: 'Qual dia prefere?' }), 'Qual dia prefere?');
  assert.equal(await humanizer.humanize({ baseReply: 'Qual dia prefere?' }), 'Qual dia prefere?');
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(records[0].usage.total_tokens, 12);
  assert.equal(records[0].status, 'error');
  OpenAIService.resetAvailability();
  fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 429, json: async () => ({}) }));
  assert.equal(await humanizer.humanize({ baseReply: 'Qual dia prefere?' }), 'Qual dia prefere?');
});
