'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const OpenAIService = require('../src/services/OpenAIService');
const IntentTypes = require('../src/constants/IntentTypes');
const AIUsageService = require('../src/services/AIUsageService');

test.beforeEach((t) => t.mock.method(AIUsageService, 'record', async () => {}));

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test('OpenAIService chama Responses API com guard rails de humanizacao', async () => {
  const originalFetch = global.fetch;
  const env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_TEMPERATURE: process.env.OPENAI_TEMPERATURE,
    OPENAI_MAX_OUTPUT_TOKENS: process.env.OPENAI_MAX_OUTPUT_TOKENS,
    OPENAI_HUMANIZATION_HISTORY_LIMIT:
      process.env.OPENAI_HUMANIZATION_HISTORY_LIMIT,
    OPENAI_PROMPT_CACHE_KEY: process.env.OPENAI_PROMPT_CACHE_KEY,
    OPENAI_DATA_POLICY: process.env.OPENAI_DATA_POLICY,
  };
  let calledUrl;
  let requestBody;
  let authorization;

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
  process.env.OPENAI_MODEL = 'gpt-5-mini';
  process.env.OPENAI_TEMPERATURE = '0.3';
  process.env.OPENAI_MAX_OUTPUT_TOKENS = '120';
  process.env.OPENAI_HUMANIZATION_HISTORY_LIMIT = '0';
  process.env.OPENAI_PROMPT_CACHE_KEY = 'test_humanizer_cache';
  process.env.OPENAI_DATA_POLICY = 'lgpd_minimal';
  OpenAIService.resetAvailability();

  global.fetch = async (url, options) => {
    calledUrl = url;
    authorization = options.headers.Authorization;
    requestBody = JSON.parse(options.body);

    return {
      ok: true,
      async json() {
        return {
          output_text: 'Claro. Qual horario fica melhor para voce?',
        };
      },
    };
  };

  try {
    const reply = await OpenAIService.humanizeReply({
      baseReply: 'Qual horario fica melhor para voce?',
      intent: IntentTypes.AGENDAMENTO,
      patientName: 'Joao Victor',
      patientMessage:
        'Quero agendar. Meu CPF é 123.456.789-10 e email joao@email.com',
    });

    assert.equal(reply, 'Claro. Qual horario fica melhor para voce?');
    assert.equal(calledUrl, 'https://api.openai.com/v1/responses');
    assert.equal(authorization, 'Bearer test-key');
    assert.equal(requestBody.model, 'gpt-5-mini');
    assert.equal(requestBody.stream, false);
    assert.equal(requestBody.store, false);
    assert.equal(requestBody.tool_choice, 'none');
    assert.equal(requestBody.parallel_tool_calls, false);
    assert.equal(requestBody.prompt_cache_key, 'test_humanizer_cache');
    assert.equal(requestBody.metadata.data_policy, 'lgpd_minimal');
    assert.equal(
      Object.prototype.hasOwnProperty.call(requestBody, 'temperature'),
      false
    );
    assert.equal(requestBody.max_output_tokens, 120);
    assert.match(requestBody.instructions, /Nao diagnostique/i);
    assert.match(requestBody.instructions, /Paciente:/);
    assert.match(requestBody.input, /TEXTO APROVADO:/);
    assert.match(requestBody.input, /Qual horario fica melhor para voce\?/);
    assert.match(requestBody.input, /NOME: Joao/);
    assert.match(requestBody.input, /\[CPF_REMOVIDO\]/);
    assert.match(requestBody.input, /\[EMAIL_REMOVIDO\]/);
    assert.doesNotMatch(requestBody.input, /Joao Victor/);
    assert.doesNotMatch(requestBody.input, /123\.456\.789-10/);
    assert.doesNotMatch(requestBody.input, /joao@email\.com/);
    assert.doesNotMatch(requestBody.input, /HIST:/);
  } finally {
    global.fetch = originalFetch;
    OpenAIService.resetAvailability();
    restoreEnv(env);
  }
});

test('OpenAIService inclui temperature apenas em modelos compativeis', () => {
  const commonPayload = {
    baseReply: 'Qual horario fica melhor para voce?',
    intent: IntentTypes.AGENDAMENTO,
    patientName: 'Joao Victor',
    patientMessage: 'Quero agendar',
    recentHistory: [],
  };

  const compatibleRequest = OpenAIService.buildHumanizationRequest({
    ...commonPayload,
    config: {
      model: 'gpt-4o-mini',
      maxOutputTokens: 120,
      temperature: 0.3,
    },
  });

  const gpt5Request = OpenAIService.buildHumanizationRequest({
    ...commonPayload,
    config: {
      model: 'gpt-5-mini',
      maxOutputTokens: 120,
      temperature: 0.3,
    },
  });

  const reasoningRequest = OpenAIService.buildHumanizationRequest({
    ...commonPayload,
    config: {
      model: 'o4-mini',
      maxOutputTokens: 120,
      temperature: 0.3,
    },
  });

  assert.equal(compatibleRequest.temperature, 0.3);
  assert.equal(
    Object.prototype.hasOwnProperty.call(gpt5Request, 'temperature'),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(reasoningRequest, 'temperature'),
    false
  );
});

test('OpenAIService usa debug compacto para nao imprimir prompt inteiro por padrao', () => {
  const originalMode = process.env.OPENAI_DEBUG_PAYLOAD;
  delete process.env.OPENAI_DEBUG_PAYLOAD;

  try {
    const debugPayload = OpenAIService.formatRequestForDebug({
      model: 'gpt-5-mini',
      instructions: 'instrucao longa que nao deve aparecer integralmente',
      input: 'CTX: andamento\nTEXTO APROVADO:\nQual data voce prefere?',
      max_output_tokens: 100,
      prompt_cache_key: 'test_cache',
    });

    assert.match(debugPayload, /input_chars/);
    assert.match(debugPayload, /instruction_chars/);
    assert.match(debugPayload, /Qual data voce prefere/);
    assert.doesNotMatch(debugPayload, /instrucao longa/);
  } finally {
    if (originalMode === undefined) {
      delete process.env.OPENAI_DEBUG_PAYLOAD;
    } else {
      process.env.OPENAI_DEBUG_PAYLOAD = originalMode;
    }
  }
});

test('OpenAIService sanitiza respostas com rotulos de roteiro', async () => {
  const originalFetch = global.fetch;
  const env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  process.env.OPENAI_API_KEY = 'test-key';
  OpenAIService.resetAvailability();

  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        output_text:
          'Paciente: nao\nAtendente: Tem algum problema renal, hepatico, imunologico ou alteracao de coagulacao?',
      };
    },
  });

  try {
    const reply = await OpenAIService.humanizeReply({
      baseReply:
        'Tem algum problema renal, hepatico, imunologico ou alteracao de coagulacao?',
      intent: IntentTypes.AGENDAMENTO,
    });

    assert.equal(
      reply,
      'Tem algum problema renal, hepatico, imunologico ou alteracao de coagulacao?'
    );
  } finally {
    global.fetch = originalFetch;
    OpenAIService.resetAvailability();
    restoreEnv(env);
  }
});

test('OpenAIService usa fallback quando a chave nao esta configurada', async () => {
  const originalFetch = global.fetch;
  const env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  let fetchCalled = false;

  delete process.env.OPENAI_API_KEY;
  OpenAIService.resetAvailability();
  global.fetch = async () => {
    fetchCalled = true;
  };

  try {
    await assert.rejects(
      OpenAIService.humanizeReply({
        baseReply: 'Qual data voce prefere?',
        intent: IntentTypes.AGENDAMENTO,
      }),
      (error) => error.code === 'OPENAI_UNAVAILABLE'
    );
    assert.equal(fetchCalled, false);
  } finally {
    global.fetch = originalFetch;
    OpenAIService.resetAvailability();
    restoreEnv(env);
  }
});

test('OpenAIService trata timeout como indisponibilidade temporaria', async () => {
  const originalFetch = global.fetch;
  const env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS,
    OPENAI_RETRY_COOLDOWN_MS: process.env.OPENAI_RETRY_COOLDOWN_MS,
  };

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_TIMEOUT_MS = '1';
  process.env.OPENAI_RETRY_COOLDOWN_MS = '1';
  OpenAIService.resetAvailability();

  global.fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('Operacao abortada por timeout');
        error.name = 'AbortError';
        reject(error);
      });
    });

  try {
    await assert.rejects(
      OpenAIService.humanizeReply({
        baseReply: 'Qual data voce prefere?',
        intent: IntentTypes.AGENDAMENTO,
      }),
      (error) => error.code === 'OPENAI_UNAVAILABLE'
    );
  } finally {
    global.fetch = originalFetch;
    OpenAIService.resetAvailability();
    restoreEnv(env);
  }
});
