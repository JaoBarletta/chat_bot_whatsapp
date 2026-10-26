'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Log = require('../src/services/ValidationLogService');
const Summary = require('../src/services/ValidationSummaryService');

test('logs correlacionam operacoes concorrentes e removem conteudo pessoal', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tcc-validation-'));
  const keys = ['VALIDATION_LOG_ENABLED', 'VALIDATION_LOG_DIR', 'VALIDATION_LOG_CONSOLE'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { VALIDATION_LOG_ENABLED: 'true', VALIDATION_LOG_DIR: directory, VALIDATION_LOG_CONSOLE: 'false' });
  t.after(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  await Promise.all(['5511999999999', '5511888888888'].map((phone) => Log.run(phone, async () => {
    await Log.record('routing.decision', { intent: 'SINTOMA', patient: 'Nome Sigiloso', phone, message: 'segredo clinico' });
    await Log.measure('db.history', async () => {});
    await assert.rejects(Log.measure('calendar.publish', async () => { throw new Error('email@paciente.com'); }));
  })));
  const text = await fs.readFile(path.join(directory, (await fs.readdir(directory))[0]), 'utf8');
  assert.doesNotMatch(text, /5511999999999|5511888888888|Nome Sigiloso|segredo clinico|email@/);
  const rows = text.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 6);
  assert.equal(new Set(rows.map((row) => row.traceId)).size, 2);
  assert.equal(new Set(rows.map((row) => row.conversation)).size, 2);
  for (const id of new Set(rows.map((row) => row.traceId))) {
    assert.equal(rows.filter((row) => row.traceId === id).length, 3);
  }
  assert.ok(rows.filter((row) => row.event === 'calendar.publish').every((row) => row.status === 'error'));
});

test('resumo distingue tokens desconhecidos, respostas locais e falhas', () => {
  const summary = Summary.summarize([
    { event: 'ai.response', status: 'completed', durationMs: 100, inputTokens: 12, outputTokens: 8, totalTokens: 20, cachedTokens: 3 },
    { event: 'ai.response', status: 'timeout', durationMs: 1000, totalTokens: null },
    { event: 'humanizer.decision', status: 'accepted' },
    { event: 'humanizer.decision', status: 'fallback', reason: 'clinical_claim' },
    { event: 'humanizer.decision', status: 'skipped', reason: 'flow_policy' },
  ]);
  assert.equal(summary.ai.totalTokens, 20);
  assert.equal(summary.ai.unknownUsage, 1);
  assert.equal(summary.ai.fallbackRate, 0.5);
  assert.equal(summary.ai.skipped, 1);
  assert.equal(summary.events[0].p95Ms, 1000);
  assert.equal(summary.reasons['humanizer.decision:clinical_claim'], 1);
});

test('falha do destino de logs nao interrompe atendimento', async (t) => {
  t.mock.method(Log, 'enabled', () => true);
  t.mock.method(fs, 'mkdir', async () => { throw new Error('disk full'); });
  const warning = t.mock.method(console, 'warn', () => {});
  assert.equal(await Log.measure('whatsapp.reply', async () => 'sent'), 'sent');
  assert.equal(warning.mock.callCount(), 1);
});
