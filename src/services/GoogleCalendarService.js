'use strict';

const UserService = require('./UserService');
const ProcedureCatalog = require('./ProcedureCatalog');

class GoogleCalendarService {
  static debugRequestSequence = 0;
  static debugWarningShown = false;

  static getConfig() {
    return {
      enabled: GoogleCalendarService.parseBoolean(
        process.env.GOOGLE_CALENDAR_ENABLED,
        false
      ),
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
      refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '',
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
      timeZone:
        process.env.GOOGLE_CALENDAR_TIMEZONE ||
        process.env.TZ ||
        'America/Sao_Paulo',
      sendUpdates: GoogleCalendarService.normalizeSendUpdates(
        process.env.GOOGLE_CALENDAR_SEND_UPDATES || 'all'
      ),
      baseUrl:
        process.env.GOOGLE_CALENDAR_BASE_URL || 'https://www.googleapis.com',
      tokenUrl:
        process.env.GOOGLE_OAUTH_TOKEN_URL ||
        'https://oauth2.googleapis.com/token',
      defaultDurationMinutes: GoogleCalendarService.parsePositiveInteger(
        process.env.APPOINTMENT_SLOT_MINUTES,
        60
      ),
      location: process.env.GOOGLE_CALENDAR_LOCATION || '',
    };
  }

  static async createAppointmentEvent({
    patient,
    intent,
    reportData = {},
    report = '',
    appointment = null,
  }) {
    const config = GoogleCalendarService.getConfig();
    if (!config.enabled) {
      return { created: false, status: 'disabled' };
    }

    const missingConfig = GoogleCalendarService.getMissingConfig(config);
    if (missingConfig.length > 0) {
      throw new Error(
        `Google Calendar habilitado, mas faltam variaveis: ${missingConfig.join(', ')}`
      );
    }

    const appointmentDateTime =
      appointment?.dateTime || reportData.appointmentDateTime;
    if (!appointmentDateTime) {
      return { created: false, status: 'without_appointment_date' };
    }

    const event = GoogleCalendarService.buildAppointmentEvent({
      config,
      patient,
      intent,
      reportData,
      report,
      appointment: {
        ...appointment,
        dateTime: appointmentDateTime,
      },
    });

    const accessToken = await GoogleCalendarService.fetchAccessToken(config);
    return GoogleCalendarService.insertEvent({
      config,
      accessToken,
      event,
    });
  }

  static buildAppointmentEvent({
    config,
    patient,
    intent,
    reportData = {},
    report = '',
    appointment = {},
  }) {
    const patientData = patient?.dataValues || patient || {};
    const start = new Date(appointment.dateTime);
    if (Number.isNaN(start.getTime())) {
      throw new Error('Data do agendamento invalida para o Google Calendar.');
    }

    const durationMinutes =
      GoogleCalendarService.parsePositiveInteger(
        appointment.durationMinutes || reportData.durationMinutes,
        config.defaultDurationMinutes
      );
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const patientEmail = GoogleCalendarService.normalizeEmail(patientData.email);
    const event = {
      summary: GoogleCalendarService.buildSummary({
        patient: patientData,
        reportData,
        appointment,
      }),
      description: GoogleCalendarService.buildDescription({
        patient: patientData,
        intent,
        reportData,
        appointment,
        report,
      }),
      start: {
        dateTime: GoogleCalendarService.toCalendarDateTime(start),
        timeZone: config.timeZone,
      },
      end: {
        dateTime: GoogleCalendarService.toCalendarDateTime(end),
        timeZone: config.timeZone,
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      reminders: {
        useDefault: true,
      },
      extendedProperties: {
        private: {
          source: 'chatbot_tcc_odontologico',
          intent: String(intent || ''),
          localAppointmentId: String(appointment.id || ''),
        },
      },
    };

    if (appointment.id) {
      event.id = GoogleCalendarService.buildEventId(appointment.id);
    }

    if (config.location) {
      event.location = config.location;
    }

    if (patientEmail) {
      event.attendees = [
        {
          email: patientEmail,
          displayName: patientData.nome || undefined,
          responseStatus: 'needsAction',
        },
      ];
    }

    return event;
  }

  static async fetchAccessToken(config) {
    const requestBody = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const needsAuthorization = data?.error === 'invalid_grant';
      const error = new Error(needsAuthorization
        ? 'Google OAuth: invalid_grant. A autorizacao foi recusada. Gere um novo refresh token usando o mesmo CLIENT_ID e CLIENT_SECRET, atualize GOOGLE_CALENDAR_REFRESH_TOKEN no .env e reinicie o bot. O token pode ter expirado ou sido revogado.'
        : `Google OAuth retornou status ${response.status}. Verifique as credenciais e a configuracao OAuth.`);
      error.code = needsAuthorization ? 'GOOGLE_REAUTH_REQUIRED' : 'GOOGLE_OAUTH_ERROR';
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    if (!data?.access_token) {
      throw new Error('Google OAuth nao retornou access_token.');
    }

    return data.access_token;
  }

  static async insertEvent({ config, accessToken, event }) {
    const requestId = GoogleCalendarService.nextDebugRequestId();
    const endpoint = GoogleCalendarService.buildInsertEventEndpoint(config);

    GoogleCalendarService.logDebugRequest({
      requestId,
      endpoint,
      event,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (response.status === 409 && event.id) {
      GoogleCalendarService.logDebugResponse({
        requestId,
        status: response.status,
        data: {
          id: event.id,
          status: 'already_exists',
        },
      });

      return {
        created: false,
        status: 'already_exists',
        eventId: event.id,
        notifiedPatient: Boolean(event.attendees?.length),
      };
    }

    if (!response.ok) {
      const details = await GoogleCalendarService.readErrorDetails(response);
      throw new Error(
        `Google Calendar retornou status ${response.status}${details}`
      );
    }

    const data = await response.json();
    GoogleCalendarService.logDebugResponse({
      requestId,
      status: response.status,
      data,
    });

    return {
      created: true,
      status: 'created',
      eventId: data?.id || event.id || null,
      htmlLink: data?.htmlLink || null,
      notifiedPatient: Boolean(event.attendees?.length),
    };
  }

  static buildInsertEventEndpoint(config) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const calendarId = encodeURIComponent(config.calendarId);
    const url = new URL(`${baseUrl}/calendar/v3/calendars/${calendarId}/events`);
    url.searchParams.set('sendUpdates', config.sendUpdates);
    return url.toString();
  }

  static buildSummary({ patient, reportData = {}, appointment = {} }) {
    const procedure = ProcedureCatalog.canonicalize(
      appointment.procedure || reportData.procedure
    ) || 'Atendimento odontologico';
    const patientName = patient.nome || 'Paciente';
    return `${procedure} - ${patientName}`;
  }

  static buildDescription({
    patient,
    intent,
    reportData = {},
    appointment = {},
    report = '',
  }) {
    const lines = [
      'AGENDAMENTO GERADO PELO CHATBOT ODONTOLOGICO',
      '',
      'PACIENTE',
      `Nome: ${patient.nome || 'Nao identificado'}`,
      `Telefone: ${patient.telefone || 'Nao informado'}`,
      `E-mail: ${patient.email || 'Nao informado'}`,
      '',
      'ATENDIMENTO',
      `Tipo de fluxo: ${intent || 'Nao informado'}`,
      `Procedimento: ${
        ProcedureCatalog.canonicalize(
          appointment.procedure || reportData.procedure
        ) || 'Nao informado'
      }`,
      `Necessidade: ${appointment.need || reportData.need || reportData.complaint || 'Nao informada'}`,
      `Complexidade: ${appointment.complexity || reportData.complexity || 'Nao classificada'}`,
      'Status: Aguardando confirmacao da equipe',
    ];

    if (report) {
      lines.push('', 'RELATORIO DO ATENDIMENTO', report);
    }

    return lines.join('\n');
  }

  static buildEventId(appointmentId) {
    const sanitized = String(appointmentId)
      .toLowerCase()
      .replace(/[^a-v0-9]/g, '');
    return `tccappt${sanitized || Date.now()}`;
  }

  static toCalendarDateTime(date) {
    const value = new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    const second = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }

  static normalizeEmail(email) {
    const value = String(email || '').trim();
    return UserService.isValidEmail(value) ? value : null;
  }

  static getMissingConfig(config) {
    return [
      ['GOOGLE_CALENDAR_CLIENT_ID', config.clientId],
      ['GOOGLE_CALENDAR_CLIENT_SECRET', config.clientSecret],
      ['GOOGLE_CALENDAR_REFRESH_TOKEN', config.refreshToken],
      ['GOOGLE_CALENDAR_ID', config.calendarId],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);
  }

  static normalizeSendUpdates(value) {
    const allowed = new Set(['all', 'externalOnly', 'none']);
    return allowed.has(value) ? value : 'all';
  }

  static parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  static parseBoolean(value, fallback) {
    if (value === undefined || value === null || String(value).trim() === '') {
      return fallback;
    }

    return /^(1|true|yes|on|sim)$/i.test(String(value).trim());
  }

  static async readErrorDetails(response) {
    try {
      const data = await response.json();
      const errorCode =
        typeof data?.error === 'string'
          ? data.error
          : data?.error?.status || data?.error?.code;
      const message =
        (typeof data?.error === 'object' ? data.error.message : null) ||
        data?.error_description ||
        data?.message;
      const details = [errorCode, message].filter(Boolean).join(' - ');
      return details ? `: ${details}` : '';
    } catch (_error) {
      return '';
    }
  }

  static isDebugEnabled() {
    return /^(1|true|yes|on|sim)$/i.test(
      String(process.env.GOOGLE_CALENDAR_DEBUG || '').trim()
    );
  }

  static nextDebugRequestId() {
    GoogleCalendarService.debugRequestSequence += 1;
    return GoogleCalendarService.debugRequestSequence;
  }

  static logDebugRequest({ requestId, endpoint, event }) {
    if (!GoogleCalendarService.isDebugEnabled()) return;

    GoogleCalendarService.warnAboutDebugData();
    GoogleCalendarService.logDebugBlock({
      requestId,
      title: 'ENVIO PARA GOOGLE CALENDAR',
      sections: [
        `Endpoint: ${endpoint}`,
        {
          label: 'Evento enviado',
          value: GoogleCalendarService.formatJson(event),
        },
      ],
    });
  }

  static logDebugResponse({ requestId, status, data }) {
    if (!GoogleCalendarService.isDebugEnabled()) return;

    GoogleCalendarService.logDebugBlock({
      requestId,
      title: 'RETORNO DO GOOGLE CALENDAR',
      sections: [
        `Status HTTP: ${status}`,
        {
          label: 'Resposta',
          value: GoogleCalendarService.formatJson(data),
        },
      ],
    });
  }

  static warnAboutDebugData() {
    if (GoogleCalendarService.debugWarningShown) return;

    console.warn(
      '[GOOGLE CALENDAR DEBUG] Ativo. O console pode exibir dados pessoais e clinicos do paciente.'
    );
    GoogleCalendarService.debugWarningShown = true;
  }

  static logDebugBlock({ requestId, title, sections }) {
    const suffix = requestId ? ` #${requestId}` : '';
    console.log('\n========================================================================');
    console.log(`[GOOGLE CALENDAR DEBUG${suffix}] ${title}`);
    console.log(`Horario: ${new Date().toISOString()}`);
    console.log('------------------------------------------------------------------------');

    for (const section of sections) {
      if (typeof section === 'string') {
        console.log(section);
      } else {
        console.log(`${section.label}:`);
        console.log(section.value);
      }
    }

    console.log('========================================================================\n');
  }

  static formatJson(value) {
    return JSON.stringify(value, null, 2);
  }
}

module.exports = GoogleCalendarService;
