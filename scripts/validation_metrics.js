'use strict';

require('dotenv').config();
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');
const Summary = require('../src/services/ValidationSummaryService');

async function main() {
  const directory = process.env.VALIDATION_LOG_DIR || path.join(process.cwd(), 'logs', 'validation');
  const date = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  let files;
  try { files = await fsp.readdir(directory); }
  catch (error) { if (error.code !== 'ENOENT') throw error; files = []; }
  const rows = [];
  let invalidLines = 0;
  for (const name of files.filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) && (!date || name.startsWith(date))).sort()) {
    const lines = readline.createInterface({ input: fs.createReadStream(path.join(directory, name)), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.schemaVersion !== 1 || typeof row.event !== 'string') throw new Error('schema');
        rows.push(row);
      } catch { invalidLines++; }
    }
  }
  const summary = { period: date || 'all', records: rows.length, invalidLines, ...Summary.summarize(rows) };
  if (process.argv.includes('--json')) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`VALIDACAO SPRINTS 1 E 2 | ${summary.period} | ${rows.length} eventos | ${invalidLines} linhas invalidas`);
    console.table(summary.events.map((row) => ({ ...row, statuses: JSON.stringify(row.statuses) })));
    console.table(summary.ai);
    console.table(summary.reasons);
    if (summary.testRuns.length) console.table(summary.testRuns);
    console.log(summary.limits);
  }
}

main().catch(() => { console.error('Nao foi possivel ler logs de validacao. Verifique diretorio e permissoes.'); process.exitCode = 1; });
