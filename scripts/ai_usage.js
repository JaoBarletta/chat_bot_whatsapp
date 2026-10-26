'use strict';

require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const directory = process.env.OPENAI_USAGE_DIR || path.join(process.cwd(), 'logs', 'ai-usage');
  let files;
  try { files = await fs.readdir(directory); }
  catch (error) { if (error.code === 'ENOENT') return console.log('Ainda nao ha metricas registradas.'); throw error; }
  const groups = new Map();
  let invalid = 0;
  for (const file of files.filter((name) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)).sort()) {
    const lines = (await fs.readFile(path.join(directory, file), 'utf8')).split('\n').filter(Boolean);
    for (const line of lines) {
      let row;
      try { row = JSON.parse(line); } catch { invalid++; continue; }
      const key = `${file.slice(0, 10)} | ${row.model}`;
      const group = groups.get(key) || { chamadas: 0, falhas: 0, consumo_desconhecido: 0, entrada: 0, saida: 0, cache: 0, total: 0, tempos: [] };
      group.chamadas++;
      if (row.status !== 'completed') group.falhas++;
      if (row.totalTokens == null) group.consumo_desconhecido++;
      group.entrada += row.inputTokens || 0;
      group.saida += row.outputTokens || 0;
      group.cache += row.cachedTokens || 0;
      group.total += row.totalTokens || 0;
      if (Number.isFinite(row.durationMs)) group.tempos.push(row.durationMs);
      groups.set(key, group);
    }
  }
  console.table([...groups].map(([periodo_modelo, group]) => {
    const { tempos, ...counts } = group;
    tempos.sort((a, b) => a - b);
    return { periodo_modelo, ...counts, p95_ms: tempos[Math.max(0, Math.ceil(tempos.length * 0.95) - 1)] ?? null };
  }));
  if (invalid) console.warn(`${invalid} linha(s) invalida(s) ignorada(s).`);
  console.log('Tokens sao os informados pela API; falhas sem usage nao significam consumo zero. Cache ja faz parte da entrada.');
}

main().catch(() => { console.error('Falha ao ler metricas. Verifique o diretorio configurado.'); process.exitCode = 1; });
