'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const { replay } = require('./lib/sprint_scenarios');

// Load historical CommonJS source in memory; never replace the working tree.
function historicalLoader(ref) {
  const root = path.resolve(__dirname, '..');
  const cache = new Map();
  const packageRequire = createRequire(path.join(root, 'package.json'));
  return function load(name) {
    const file = `${name.replace(/\.js$/, '')}.js`.replaceAll('\\', '/');
    if (cache.has(file)) return cache.get(file).exports;
    const source = execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = (request) => request.startsWith('.')
      ? load(path.posix.normalize(path.posix.join(path.posix.dirname(file), request)))
      : packageRequire(request);
    const factory = vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${source}\n})`, { filename: `${ref}/${file}` });
    factory(localRequire, module, module.exports, path.join(root, file), path.dirname(path.join(root, file)));
    return module.exports;
  };
}

async function main() {
  process.env.VALIDATION_LOG_ENABLED = 'false';
  global.fetch = async () => { throw new Error('Rede bloqueada no benchmark offline'); };
  process.env.OPENAI_DEBUG = 'false';
  process.env.OLLAMA_DEBUG = 'false';
  const ref = process.argv[2] || '10c95b9';
  if (!/^[a-f0-9]{7,40}$/i.test(ref)) throw new Error('Informe o hash da revisao anterior.');
  const results = [];
  const historical = historicalLoader(ref);
  // Warm module caches before timing either revision.
  await replay({ type: 'pendente', load: historical });
  await replay({ type: 'pendente' });
  for (const [version, load, mode] of [
    [ref, historical, 'always'], ['atual-always', undefined, 'always'], ['atual-smart', undefined, 'smart'],
  ]) {
    for (const type of ['limpeza', 'triagem', 'implante', 'pendente']) {
      const started = performance.now();
      try {
        const result = await replay({ type, load, mode });
        results.push({ version, scenario: type, passed: true, ...result, durationMs: +(performance.now() - started).toFixed(2) });
      } catch (error) {
        results.push({ version, scenario: type, passed: false, reason: error.message, durationMs: +(performance.now() - started).toFixed(2) });
      }
    }
  }
  const latencies = [];
  const batchStart = performance.now();
  for (let batch = 0; batch < 10; batch++) {
    await Promise.all(Array.from({ length: 10 }, async (_, i) => {
      const started = performance.now();
      await replay({ id: `load-${batch}-${i}` });
      latencies.push(performance.now() - started);
    }));
  }
  const elapsedMs = performance.now() - batchStart;
  latencies.sort((a, b) => a - b);
  const output = {
    generatedAt: new Date().toISOString(),
    method: 'Replays offline com IA echo, banco, WhatsApp e Calendar simulados. Nao mede latencia de rede, tokens reais nem qualidade linguistica da IA.',
    comparison: results,
    load: { conversations: latencies.length, concurrency: 10, elapsedMs: +elapsedMs.toFixed(2), p50Ms: +latencies[49].toFixed(2), p95Ms: +latencies[94].toFixed(2) },
  };
  await fs.mkdir(path.join(__dirname, '../docs/evidence'), { recursive: true });
  await fs.writeFile(path.join(__dirname, '../docs/evidence/sprint2-benchmark.json'), JSON.stringify(output, null, 2) + '\n');
  console.table(results);
  console.log(output.load);
  if (results.some((row) => row.version.startsWith('atual') && !row.passed)) process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
