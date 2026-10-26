'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const AIUsageService = require('../src/services/AIUsageService');

test('persiste usage real sem texto clinico e sem transformar consumo ausente em zero', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tcc-usage-'));
  const previous = process.env.OPENAI_USAGE_DIR;
  process.env.OPENAI_USAGE_DIR = directory;
  t.after(async () => {
    if (previous === undefined) delete process.env.OPENAI_USAGE_DIR;
    else process.env.OPENAI_USAGE_DIR = previous;
    await fs.rm(directory, { recursive: true, force: true });
  });
  await Promise.all([
    AIUsageService.record({ model: 'test', status: 'completed', durationMs: 42,
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120, input_tokens_details: { cached_tokens: 60 } },
      patientMessage: 'segredo', apiKey: 'segredo' }),
    AIUsageService.record({ model: 'test', status: 'timeout', durationMs: 100 }),
  ]);
  const files = await fs.readdir(directory);
  const text = await fs.readFile(path.join(directory, files[0]), 'utf8');
  assert.doesNotMatch(text, /segredo|patientMessage|apiKey/);
  const rows = text.trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.status === 'completed').totalTokens, 120);
  assert.equal(rows.find((row) => row.status === 'timeout').totalTokens, null);
});
