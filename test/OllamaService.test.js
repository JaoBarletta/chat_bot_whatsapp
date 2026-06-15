'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const OllamaService = require('../src/services/OllamaService');
const IntentTypes = require('../src/constants/IntentTypes');

test('humanizeReply envia somente o texto aprovado para reformulacao', async () => {
  const originalFetch = global.fetch;
  let requestBody;
  OllamaService.resetAvailability();

  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return { response: 'Claro! Qual período fica melhor para você?' };
      },
    };
  };

  try {
    const reply = await OllamaService.humanizeReply({
      baseReply: 'Qual período fica melhor para você?',
      intent: IntentTypes.AGENDAMENTO,
      patientMessage: 'Quero marcar uma limpeza',
    });

    assert.equal(reply, 'Claro! Qual período fica melhor para você?');
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.options.temperature, 0.4);
    assert.match(requestBody.prompt, /TEXTO APROVADO:/);
    assert.match(requestBody.prompt, /Qual período fica melhor para você\?/);
    assert.doesNotMatch(requestBody.prompt, /Classifique a mensagem/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('OllamaService entra em cooldown depois de falha de conexao', async () => {
  const originalFetch = global.fetch;
  const originalCooldown = process.env.OLLAMA_RETRY_COOLDOWN_MS;
  let calls = 0;
  OllamaService.resetAvailability();
  process.env.OLLAMA_RETRY_COOLDOWN_MS = '60000';
  global.fetch = async () => {
    calls += 1;
    throw new Error('fetch failed');
  };

  try {
    await assert.rejects(
      OllamaService.humanizeReply({
        baseReply: 'Como posso ajudar?',
        intent: IntentTypes.OUTRO,
      }),
      (error) => error.code === 'OLLAMA_UNAVAILABLE'
    );

    await assert.rejects(
      OllamaService.humanizeReply({
        baseReply: 'Como posso ajudar?',
        intent: IntentTypes.OUTRO,
      }),
      (error) => error.code === 'OLLAMA_UNAVAILABLE'
    );
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
    OllamaService.resetAvailability();
    if (originalCooldown === undefined) {
      delete process.env.OLLAMA_RETRY_COOLDOWN_MS;
    } else {
      process.env.OLLAMA_RETRY_COOLDOWN_MS = originalCooldown;
    }
  }
});

test('sanitizeReply remove rotulo de mensagem reformulada', () => {
  assert.equal(
    OllamaService.sanitizeReply(
      'Mensagem reformulada:\nClaro! Qual horário fica melhor para você?'
    ),
    'Claro! Qual horário fica melhor para você?'
  );
  assert.equal(
    OllamaService.sanitizeReply(
      '**Resposta reformulada:**\nTudo certo. Posso continuar?'
    ),
    'Tudo certo. Posso continuar?'
  );
});

test('OLLAMA_DEBUG exibe prompt, resposta bruta e resposta sanitizada', async () => {
  const originalFetch = global.fetch;
  const originalDebug = process.env.OLLAMA_DEBUG;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const logs = [];

  process.env.OLLAMA_DEBUG = 'true';
  OllamaService.resetAvailability();
  OllamaService.debugWarningShown = false;
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => logs.push(args.join(' '));
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        response: 'Mensagem reformulada: Qual data fica melhor para você?',
      };
    },
  });

  try {
    const reply = await OllamaService.humanizeReply({
      baseReply: 'Qual data você prefere?',
      intent: IntentTypes.AGENDAMENTO,
      patientMessage: 'Quero agendar uma limpeza',
    });
    const output = logs.join('\n');

    assert.equal(reply, 'Qual data fica melhor para você?');
    assert.match(output, /ENVIO \(humanizeReply\)/);
    assert.match(output, /Prompt enviado:/);
    assert.match(output, /TEXTO APROVADO:/);
    assert.match(output, /Resposta bruta:/);
    assert.match(output, /Mensagem reformulada:/);
    assert.match(output, /Resposta sanitizada:/);
    assert.match(output, /Qual data fica melhor para você\?/);
  } finally {
    global.fetch = originalFetch;
    console.log = originalLog;
    console.warn = originalWarn;
    OllamaService.debugWarningShown = false;

    if (originalDebug === undefined) {
      delete process.env.OLLAMA_DEBUG;
    } else {
      process.env.OLLAMA_DEBUG = originalDebug;
    }
  }
});
