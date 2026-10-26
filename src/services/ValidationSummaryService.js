'use strict';

class ValidationSummaryService {
  static summarize(rows) {
    const groups = new Map();
    const reasons = {};
    let knownUsage = 0, unknownUsage = 0, input = 0, output = 0, total = 0, cached = 0;
    for (const row of rows) {
      const key = row.event;
      const group = groups.get(key) || { event: key, count: 0, statuses: {}, durations: [] };
      group.count++;
      group.statuses[row.status || 'unknown'] = (group.statuses[row.status || 'unknown'] || 0) + 1;
      if (Number.isFinite(row.durationMs)) group.durations.push(row.durationMs);
      groups.set(key, group);
      if (row.reason) {
        const reason = `${row.event}:${row.reason}`;
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
      if (row.event === 'ai.response') {
        if (Number.isFinite(row.totalTokens)) {
          knownUsage++; total += row.totalTokens;
          input += row.inputTokens || 0; output += row.outputTokens || 0; cached += row.cachedTokens || 0;
        } else unknownUsage++;
      }
    }
    const events = [...groups.values()].map(({ durations, ...group }) => {
      durations.sort((a, b) => a - b);
      const percentile = (q) => durations.length ? durations[Math.ceil(durations.length * q) - 1] : null;
      return { ...group, measured: durations.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95),
        meanMs: durations.length ? +(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : null };
    });
    const decisions = groups.get('humanizer.decision')?.statuses || {};
    const evaluated = (decisions.accepted || 0) + (decisions.fallback || 0);
    return { events, reasons,
      testRuns: rows.filter((row) => row.event === 'test.suite').map(({ timestamp, status, tests, passed, failed, skipped, durationMs }) =>
        ({ timestamp, status, tests, passed, failed, skipped, durationMs })),
      ai: { knownUsage, unknownUsage, inputTokens: input, outputTokens: output, totalTokens: total, cachedTokens: cached,
        evaluated, fallbackRate: evaluated ? (decisions.fallback || 0) / evaluated : null,
        skipped: decisions.skipped || 0 },
      limits: 'Latencias por evento; message.process exclui buffer/espera. Fallback inclui indisponibilidade. Taxas nao medem qualidade clinica. Tokens desconhecidos nao sao zero. Sem comparacao com MVP anterior.' };
  }
}

module.exports = ValidationSummaryService;
