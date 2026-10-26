'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const GoogleCalendarService = require('../src/services/GoogleCalendarService');
const IntentTypes = require('../src/constants/IntentTypes');
const ValidationLog = require('../src/services/ValidationLogService');

test('Google OAuth invalid_grant solicita reautorizacao sem expor credenciais', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: false, status: 400, json: async () => ({
      error: 'invalid_grant', error_description: 'sensitive-provider-detail',
    }) };
  };
  try {
    await assert.rejects(GoogleCalendarService.fetchAccessToken({
      tokenUrl: 'https://oauth2.googleapis.com/token', clientId: 'id',
      clientSecret: 'secret-value', refreshToken: 'refresh-value',
    }), error => {
      assert.equal(error.code, 'GOOGLE_REAUTH_REQUIRED');
      assert.equal(ValidationLog.errorCode(error), 'GOOGLE_REAUTH_REQUIRED');
      assert.equal(error.status, 400);
      assert.match(error.message, /reinicie o bot/);
      assert.doesNotMatch(error.message, /sensitive-provider-detail|secret-value|refresh-value/);
      return true;
    });
  } finally { global.fetch = originalFetch; }
});

test('Google OAuth falha nao JSON preserva status e codigo seguro', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 502,
    json: async () => { throw new SyntaxError('not json'); } });
  try {
    await assert.rejects(GoogleCalendarService.fetchAccessToken({
      tokenUrl: 'https://oauth2.googleapis.com/token',
    }), error => error.code === 'GOOGLE_OAUTH_ERROR' && error.status === 502);
  } finally { global.fetch = originalFetch; }
});

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function snapshotEnv() {
  return {
    GOOGLE_CALENDAR_ENABLED: process.env.GOOGLE_CALENDAR_ENABLED,
    GOOGLE_CALENDAR_CLIENT_ID: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    GOOGLE_CALENDAR_CLIENT_SECRET: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    GOOGLE_CALENDAR_REFRESH_TOKEN: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
    GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID,
    GOOGLE_CALENDAR_TIMEZONE: process.env.GOOGLE_CALENDAR_TIMEZONE,
    GOOGLE_CALENDAR_SEND_UPDATES: process.env.GOOGLE_CALENDAR_SEND_UPDATES,
    GOOGLE_CALENDAR_BASE_URL: process.env.GOOGLE_CALENDAR_BASE_URL,
    GOOGLE_OAUTH_TOKEN_URL: process.env.GOOGLE_OAUTH_TOKEN_URL,
    GOOGLE_CALENDAR_DEBUG: process.env.GOOGLE_CALENDAR_DEBUG,
    APPOINTMENT_SLOT_MINUTES: process.env.APPOINTMENT_SLOT_MINUTES,
  };
}

test('GoogleCalendarService cria evento com convidado e sendUpdates all', async () => {
  const originalFetch = global.fetch;
  const env = snapshotEnv();
  const calls = [];

  process.env.GOOGLE_CALENDAR_ENABLED = 'true';
  process.env.GOOGLE_CALENDAR_CLIENT_ID = 'client-id';
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = 'refresh-token';
  process.env.GOOGLE_CALENDAR_ID = 'primary';
  process.env.GOOGLE_CALENDAR_TIMEZONE = 'America/Sao_Paulo';
  process.env.GOOGLE_CALENDAR_SEND_UPDATES = 'all';
  process.env.APPOINTMENT_SLOT_MINUTES = '60';
  delete process.env.GOOGLE_CALENDAR_DEBUG;

  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('oauth2.googleapis.com')) {
      return {
        ok: true,
        async json() {
          return { access_token: 'access-token' };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: 'tccappt15',
          htmlLink: 'https://calendar.google.com/event?eid=abc',
        };
      },
    };
  };

  try {
    const result = await GoogleCalendarService.createAppointmentEvent({
      patient: {
        nome: 'Joao Victor',
        telefone: '554196950668',
        email: 'joao@example.com',
      },
      intent: IntentTypes.AGENDAMENTO,
      appointment: {
        id: 15,
        dateTime: new Date(2026, 5, 18, 15, 0, 0),
        procedure: 'limpeza',
        need: 'Limpeza de rotina',
        complexity: 'BAIXA',
      },
      report: 'RELATORIO DO PACIENTE',
    });

    assert.equal(result.created, true);
    assert.equal(result.notifiedPatient, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.method, 'POST');
    assert.match(calls[0].options.body, /grant_type=refresh_token/);
    assert.match(calls[1].url, /calendar\/v3\/calendars\/primary\/events/);
    assert.match(calls[1].url, /sendUpdates=all/);
    assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');

    const event = JSON.parse(calls[1].options.body);
    assert.equal(event.id, 'tccappt15');
    assert.equal(event.summary, 'Limpeza - Joao Victor');
    assert.equal(event.start.dateTime, '2026-06-18T15:00:00');
    assert.equal(event.end.dateTime, '2026-06-18T16:00:00');
    assert.equal(event.start.timeZone, 'America/Sao_Paulo');
    assert.equal(event.attendees[0].email, 'joao@example.com');
    assert.equal(event.attendees[0].responseStatus, 'needsAction');
    assert.match(event.description, /Procedimento: Limpeza/);
    assert.match(event.description, /Status: Aguardando confirmacao da equipe/);
    assert.match(event.description, /RELATORIO DO PACIENTE/);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(env);
  }
});

test('GoogleCalendarService nao chama API quando esta desabilitado', async () => {
  const originalFetch = global.fetch;
  const env = snapshotEnv();
  let called = false;

  process.env.GOOGLE_CALENDAR_ENABLED = 'false';
  global.fetch = async () => {
    called = true;
  };

  try {
    const result = await GoogleCalendarService.createAppointmentEvent({
      patient: { nome: 'Ana', email: 'ana@example.com' },
      appointment: {
        dateTime: new Date(2026, 5, 18, 9, 0, 0),
      },
    });

    assert.equal(result.created, false);
    assert.equal(result.status, 'disabled');
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(env);
  }
});

test('GoogleCalendarService cria evento sem convidado quando email e invalido', () => {
  const event = GoogleCalendarService.buildAppointmentEvent({
    config: {
      timeZone: 'America/Sao_Paulo',
      defaultDurationMinutes: 30,
      location: '',
    },
    patient: {
      nome: 'Maria',
      telefone: '5511999999999',
      email: 'email-invalido',
    },
    intent: IntentTypes.SINTOMA,
    appointment: {
      dateTime: new Date(2026, 5, 18, 10, 30, 0),
      procedure: 'Avaliacao',
      complexity: 'MEDIA',
    },
  });

  assert.equal(event.summary, 'Avaliacao - Maria');
  assert.equal(event.start.dateTime, '2026-06-18T10:30:00');
  assert.equal(event.end.dateTime, '2026-06-18T11:00:00');
  assert.equal(Object.prototype.hasOwnProperty.call(event, 'attendees'), false);
});
