'use strict';

require('dotenv').config();

const GoogleCalendarService = require('../src/services/GoogleCalendarService');
const IntentTypes = require('../src/constants/IntentTypes');

function nextBusinessTestDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);

  while ([0, 6].includes(date.getDay())) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

async function main() {
  if (process.argv.includes('--auth-only')) {
    const config = GoogleCalendarService.getConfig();
    const missing = GoogleCalendarService.getMissingConfig(config);
    if (missing.length) throw new Error(`Configuracao ausente: ${missing.join(', ')}`);
    await GoogleCalendarService.fetchAccessToken(config);
    console.log('Autenticacao Google OAuth validada. Nenhum evento ou convite enviado.');
    console.log('Este teste nao verifica a permissao de escrita na agenda.');
    return;
  }
  const appointmentDate = nextBusinessTestDate();
  const testEmail = String(
    process.env.GOOGLE_CALENDAR_TEST_ATTENDEE_EMAIL || ''
  ).trim();

  if (!/^(1|true|yes|on|sim)$/i.test(process.env.GOOGLE_CALENDAR_ENABLED || '')) {
    console.warn(
      'GOOGLE_CALENDAR_ENABLED esta desativado no .env. Forcando ativacao apenas neste teste isolado.'
    );
    process.env.GOOGLE_CALENDAR_ENABLED = 'true';
  }

  if (!process.env.GOOGLE_CALENDAR_DEBUG) {
    process.env.GOOGLE_CALENDAR_DEBUG = 'true';
  }

  const result = await GoogleCalendarService.createAppointmentEvent({
    patient: {
      nome: 'Paciente Teste TCC',
      telefone: '5500000000000',
      email: testEmail || null,
    },
    intent: IntentTypes.AGENDAMENTO,
    appointment: {
      id: `test${Date.now()}`,
      dateTime: appointmentDate,
      durationMinutes: 30,
      procedure: 'Teste Google Calendar',
      need: 'Validacao isolada da integracao com Google Calendar',
      complexity: 'BAIXA',
      status: 'pendente',
    },
    reportData: {
      procedure: 'Teste Google Calendar',
      need: 'Validacao isolada da integracao com Google Calendar',
      complexity: 'BAIXA',
      appointmentDateTime: appointmentDate,
      durationMinutes: 30,
    },
    report: [
      'RELATORIO DE TESTE',
      'Origem: scripts/test_google_calendar.js',
      'Finalidade: validar credenciais OAuth e permissao de escrita na agenda.',
      testEmail
        ? `Convidado de teste: ${testEmail}`
        : 'Convidado de teste: nao informado',
    ].join('\n'),
  });

  console.log('\nRESULTADO DO TESTE GOOGLE CALENDAR');
  console.log(JSON.stringify(result, null, 2));

  if (!result.created && result.status !== 'already_exists') {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('\nFALHA NO TESTE GOOGLE CALENDAR');
  console.error(error.message);
  process.exitCode = 1;
});
