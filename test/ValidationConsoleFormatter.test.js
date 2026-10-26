'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Formatter = require('../src/services/ValidationConsoleFormatter');

test('formata evento com horario brasileiro, identificador curto e duracao', () => {
  const result = Formatter.format({ timestamp: '2026-10-23T18:30:00Z',
    event: 'calendar.result', status: 'created', traceId: '2ab54603-full-id', durationMs: 1920 });
  assert.match(result, /15:30:00/);
  assert.match(result, /EVENTO CRIADO.*Google Calendar/);
  assert.match(result, /Mensagem: 2ab54603 \| Tempo: 1,92 s/);
  assert.doesNotMatch(result, /full-id|undefined/);
});

test('mostra etapas, booleanos e zero sem expor campos de paciente', () => {
  const result = Formatter.format({ timestamp: '2026-10-23T18:30:00Z',
    event: 'flow.transition', status: 'processed', stepBefore: 'waiting_confirmation',
    stepAfter: 'idle', finished: true, hasPhoto: false, inputTokens: 0,
    patient: 'Nome privado', message: 'Texto clinico', durationMs: 5 });
  assert.match(result, /Aguardando confirmacao/);
  assert.match(result, /Sem etapa ativa/);
  assert.match(result, /Fluxo finalizado: Sim/);
  assert.match(result, /Foto no relatorio: Nao/);
  assert.match(result, /Tokens de entrada: 0/);
  assert.match(result, /Tempo: 5 ms/);
  assert.doesNotMatch(result, /Nome privado|Texto clinico/);
});

test('preserva codigos desconhecidos e explica erro de autorizacao', () => {
  const result = Formatter.format({ event: 'novo.evento', status: 'error',
    errorCode: 'GOOGLE_REAUTH_REQUIRED', reason: 'novo_motivo\nlinha', totalTokens: null });
  assert.match(result, /ERRO.*novo.evento/);
  assert.match(result, /Renove a autorizacao do Google Calendar/);
  assert.match(result, /Motivo: novo_motivo linha/);
  assert.match(result, /Total de tokens: Nao informado/);
});
