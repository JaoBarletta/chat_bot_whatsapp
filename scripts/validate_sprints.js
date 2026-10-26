'use strict';

require('dotenv').config();
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ValidationLog = require('../src/services/ValidationLogService');

async function main() {
  const root = path.resolve(__dirname, '..');
  const files = fs.readdirSync(path.join(root, 'test')).filter((file) => file.endsWith('.test.js')).map((file) => path.join('test', file));
  const start = Date.now();
  const child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...files], {
    cwd: root, env: { ...process.env, VALIDATION_LOG_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output = (output + chunk).slice(-1000000); });
  child.stderr.on('data', () => {});
  const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code) => resolve(code ?? 1)); });
  const count = (name) => {
    const match = output.match(new RegExp(`^# ${name} (\\d+)$`, 'm'));
    return match ? Number(match[1]) : null;
  };
  const result = { tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped'),
    exitCode, status: exitCode === 0 && count('tests') > 0 ? 'passed' : 'failed', durationMs: Date.now() - start };
  await ValidationLog.record('test.suite', result);
  console.table(result);
  if (result.status === 'failed') console.error('Execute npm test para consultar os detalhes das falhas.');
  process.exitCode = result.status === 'passed' ? 0 : 1;
}

main().catch(() => { console.error('Falha ao executar a suite de validacao.'); process.exitCode = 1; });
