'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const ConsoleFormatter = require('./ValidationConsoleFormatter');

const context = new AsyncLocalStorage();
const secret = randomBytes(32);
const runId = randomUUID();
const fields = new Set([
  'status', 'reason', 'intent', 'stepBefore', 'stepAfter', 'model', 'mode',
  'durationMs', 'httpStatus', 'inputTokens', 'outputTokens', 'totalTokens',
  'cachedTokens', 'inputChars', 'instructionChars', 'outputChars', 'historyItems',
  'redacted', 'truncated', 'hasImage', 'fragmentCount', 'bufferMs', 'queueMs',
  'finished', 'reportable', 'hasAppointment', 'hasAnamnesis', 'hasPhoto',
  'errorCode', 'promptVersion',
  'tests', 'passed', 'failed', 'skipped', 'exitCode',
  'timeoutMs', 'maxOutputTokens', 'dataPolicy',
]);

class ValidationLogService {
  static enabled() {
    return process.env.VALIDATION_LOG_ENABLED !== 'false' &&
      (!process.env.NODE_TEST_CONTEXT || process.env.VALIDATION_LOG_ENABLED === 'true');
  }

  static run(conversationId, action) {
    return context.run({ traceId: randomUUID(), conversation: createHmac('sha256', secret)
      .update(String(conversationId || '')).digest('hex').slice(0, 24) }, action);
  }

  static errorCode(error) {
    const code = error?.code || error?.original?.code || error?.name;
    const allowed = ['SLOT_UNAVAILABLE', 'OPENAI_UNAVAILABLE', 'AbortError', 'TimeoutError',
      'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EACCES', 'ER_LOCK_DEADLOCK',
      'GOOGLE_REAUTH_REQUIRED', 'GOOGLE_OAUTH_ERROR',
      'SequelizeConnectionError', 'SequelizeDatabaseError', 'SequelizeValidationError'];
    return allowed.includes(code) ? code : 'UNEXPECTED_ERROR';
  }

  static async record(event, data = {}) {
    if (!this.enabled()) return;
    const row = { schemaVersion: 1, timestamp: new Date().toISOString(), runId,
      ...context.getStore(), event };
    for (const [key, value] of Object.entries(data)) {
      if (fields.has(key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value))) {
        row[key] = value;
      }
    }
    try {
      const directory = process.env.VALIDATION_LOG_DIR || path.join(process.cwd(), 'logs', 'validation');
      await fs.mkdir(directory, { recursive: true });
      await fs.appendFile(path.join(directory, `${row.timestamp.slice(0, 10)}.jsonl`),
        JSON.stringify(row) + '\n', { mode: 0o600 });
      if (process.env.VALIDATION_LOG_CONSOLE !== 'false') {
        console.log(ConsoleFormatter.format(row));
      }
    } catch (_error) {
      console.warn('[VALIDACAO] Falha ao gravar metricas. Verifique acesso e espaco em disco.');
    }
  }

  static async measure(event, action, data = {}) {
    const start = performance.now();
    try {
      const result = await action();
      await this.record(event, { ...data, status: 'success', durationMs: Math.round(performance.now() - start) });
      return result;
    } catch (error) {
      await this.record(event, { ...data, status: 'error', errorCode: this.errorCode(error), durationMs: Math.round(performance.now() - start) });
      throw error;
    }
  }
}

module.exports = ValidationLogService;
