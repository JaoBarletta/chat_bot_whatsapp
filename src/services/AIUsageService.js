'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Only operational metadata belongs here; never prompts, patient IDs or replies.
class AIUsageService {
  static async record({ model, usage, durationMs, status, requestId }) {
    if (process.env.OPENAI_USAGE_ENABLED === 'false') return;
    const number = (value) => Number.isFinite(value) && value >= 0 ? value : null;
    const record = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      model,
      requestId,
      status,
      durationMs: number(durationMs),
      inputTokens: number(usage?.input_tokens),
      outputTokens: number(usage?.output_tokens),
      totalTokens: number(usage?.total_tokens),
      cachedTokens: number(usage?.input_tokens_details?.cached_tokens),
    };
    const directory = process.env.OPENAI_USAGE_DIR || path.join(process.cwd(), 'logs', 'ai-usage');
    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.appendFile(path.join(directory, `${record.timestamp.slice(0, 10)}.jsonl`),
        `${JSON.stringify(record)}\n`, { mode: 0o600 });
    } catch (_error) {
      console.warn('[IA] Nao foi possivel persistir metricas de consumo. Verifique o diretorio de logs.');
    }
  }
}

module.exports = AIUsageService;
