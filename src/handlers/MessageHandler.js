'use strict';

const IntentTypes = require('../constants/IntentTypes');
const FlowRouter = require('../services/FlowRouter');
const UserService = require('../services/UserService');
const AtendimentoService = require('../services/AtendimentoService');
const ResponseHumanizerService = require('../services/ResponseHumanizerService');
const PatientReportService = require('../services/PatientReportService');
const GoogleCalendarService = require('../services/GoogleCalendarService');
const AgendamentoFlow = require('../flows/AgendamentoFlow');
const TriagemFlow = require('../flows/TriagemFlow');
const FinanceiroFlow = require('../flows/FinanceiroFlow');
const HistoricoFlow = require('../flows/HistoricoFlow');
const HumanoFlow = require('../flows/HumanoFlow');
const DuvidaFlow = require('../flows/DuvidaFlow');
const OutroFlow = require('../flows/OutroFlow');
const ValidationLog = require('../services/ValidationLogService');

class MessageHandler {
  constructor({
    sendMessage,
    router = new FlowRouter(),
    userService = UserService,
    atendimentoService = AtendimentoService,
    responseHumanizer = new ResponseHumanizerService(),
    reportService = PatientReportService,
    calendarService = GoogleCalendarService,
    flows,
    onAttendanceCompleted,
    onTriageCompleted,
  }) {
    if (typeof sendMessage !== 'function') {
      throw new Error('MessageHandler requer uma funcao sendMessage.');
    }

    this.sendMessage = sendMessage;
    this.router = router;
    this.userService = userService;
    this.atendimentoService = atendimentoService;
    this.responseHumanizer = responseHumanizer;
    this.reportService = reportService;
    this.calendarService = calendarService;
    this.registrationSessions = new Map();
    this.activeFlows = new Map();
    this.conversationHistory = new Map();
    this.onAttendanceCompleted =
      onAttendanceCompleted ||
      onTriageCompleted ||
      this.logAttendanceReport;
    this.flows = flows || new Map([
      [IntentTypes.AGENDAMENTO, new AgendamentoFlow()],
      [IntentTypes.SINTOMA, new TriagemFlow()],
      [IntentTypes.FINANCEIRO, new FinanceiroFlow()],
      [IntentTypes.HISTORICO, new HistoricoFlow()],
      [IntentTypes.HUMANO, new HumanoFlow()],
      [IntentTypes.DUVIDA, new DuvidaFlow()],
      [IntentTypes.OUTRO, new OutroFlow()],
    ]);
  }

  async handle(payload) {
    return ValidationLog.run(payload.conversationId, () => ValidationLog.measure(
      'message.process', async () => {
        const before = this.activeFlows.get(payload.conversationId);
        const stepBefore = this.flows.get(before)?.getState?.(payload.conversationId)?.step ||
          this.registrationSessions.get(payload.conversationId)?.step || 'idle';
        const result = await this.processMessage(payload);
        const after = this.activeFlows.get(payload.conversationId);
        await ValidationLog.record('flow.transition', {
          intent: result?.intent || after || before || 'OUTRO', stepBefore,
          stepAfter: this.flows.get(after)?.getState?.(payload.conversationId)?.step ||
            this.registrationSessions.get(payload.conversationId)?.step || 'idle',
          finished: result?.finished === true, reportable: result?.reportable === true,
          status: this.isCancellation(String(payload.message || '').trim()) ? 'cancelled' : 'processed',
        });
        return result;
      }, { inputChars: String(payload.message || '').length, hasImage: Boolean(payload.hasImage) }
    ));
  }

  async processMessage({
    conversationId,
    phone,
    message,
    hasImage = false,
    media = null,
  }) {
    const normalizedMessage = String(message || '').trim();
    const context = {
      conversationId,
      phone,
      message: normalizedMessage,
      hasImage,
      media,
      patient: null,
    };

    if (this.isCancellation(normalizedMessage)) {
      return this.cancelCurrentInteraction(context);
    }

    const registration = this.registrationSessions.get(conversationId);
    if (registration) {
      return this.handleRegistration(context, registration);
    }

    const patient = await ValidationLog.measure('db.patient_lookup', () => this.userService.findByPhone(phone));
    if (!patient) {
      this.registrationSessions.set(conversationId, { step: 'waiting_name' });
      return this.sendText(
        conversationId,
        'Oi! Ainda não encontrei seu cadastro por aqui. Para começarmos, qual é o seu nome completo?'
      );
    }

    context.patient = patient;

    const activeIntent = this.activeFlows.get(conversationId);
    if (activeIntent) {
      return this.handleActiveFlow(activeIntent, context);
    }

    if (!normalizedMessage) {
      return this.sendText(
        conversationId,
        'Pode me contar como posso te ajudar?'
      );
    }

    const intent = await this.router.route(normalizedMessage);
    await ValidationLog.record('routing.decision', { intent, status: 'local_rules' });
    return this.startFlow(intent, context);
  }

  async startFlow(intent, context) {
    await ValidationLog.record('flow.started', { intent, status: 'started' });
    const flow = this.flows.get(intent) || this.flows.get(IntentTypes.OUTRO);
    const result = await flow.start(context);

    if (!result.finished) {
      this.activeFlows.set(context.conversationId, flow.intent);
    }

    await this.deliverFlowResult(context, result);
    return result;
  }

  async handleActiveFlow(activeIntent, context) {
    const activeFlow = this.flows.get(activeIntent);
    const collectingAnamnesis = activeFlow?.getState?.(context.conversationId)
      ?.step?.startsWith('waiting_anamnesis');
    const interruption = context.message
      ? this.router.detectByRegex(context.message)
      : null;

    if (
      interruption === IntentTypes.HUMANO ||
      (activeIntent === IntentTypes.AGENDAMENTO && !collectingAnamnesis && interruption === IntentTypes.SINTOMA)
    ) {
      await ValidationLog.record('flow.interrupted', { intent: activeIntent, reason: interruption === IntentTypes.HUMANO ? 'human_requested' : 'symptom_reported', status: 'interrupted' });
      const currentFlow = this.flows.get(activeIntent);
      currentFlow?.cancel(context);
      this.activeFlows.delete(context.conversationId);
      return this.startFlow(interruption, context);
    }

    const flow = this.flows.get(activeIntent);
    if (!flow) {
      this.activeFlows.delete(context.conversationId);
      return this.startFlow(IntentTypes.OUTRO, context);
    }

    const result = await flow.handle(context);
    if (result.finished) {
      this.activeFlows.delete(context.conversationId);
    }

    await this.deliverFlowResult(context, result);
    return result;
  }

  async deliverFlowResult(context, result) {
    if (result.allowHumanization === false) {
      await ValidationLog.record('humanizer.decision', { status: 'skipped', reason: 'flow_policy', intent: result.intent });
    }
    const recentHistory = this.conversationHistory.get(context.conversationId) || [];
    const patient = context.patient?.dataValues || context.patient || {};
    const reply = result.allowHumanization === false
      ? result.reply
      : await this.responseHumanizer.humanize({
          baseReply: result.reply,
          intent: result.intent,
          patientName: patient.nome,
          allowPatientName: recentHistory.length === 0,
          patientMessage: context.message,
          recentHistory,
        });

    result.reply = reply;
    await this.sendText(context.conversationId, reply);
    this.rememberConversation(context.conversationId, context.message, reply);

    if (this.shouldSendReport(result)) {
      const reportData = result.reportData || {
        complaint: context.message,
        appointmentDate: null,
      };
      const report = this.reportService.build({
        patient: context.patient,
        intent: result.intent,
        data: reportData,
      });
      await ValidationLog.record('attendance.completed', { intent: result.intent,
        hasAppointment: Boolean(result.appointment), hasPhoto: Boolean(reportData.photo),
        hasAnamnesis: Object.values(reportData.anamnesis || {}).some((value) => value !== null),
        status: 'completed' });

      try {
        await ValidationLog.measure('report.callback', () => this.onAttendanceCompleted({
          report,
          reportData,
          patient: context.patient,
          conversationId: context.conversationId,
          photo: reportData.photo || null,
        }));
      } catch (error) {
        console.error('Erro ao encaminhar relatorio do atendimento:', error.message);
      }

      await this.publishCalendarEvent({
        result,
        report,
        reportData,
        patient: context.patient,
      });
    }

    await this.atendimentoService.saveHistory({
      idUsuario: context.patient.id,
      telefone: context.patient.telefone,
      mensagemRecebida: context.message,
      tipoSolicitacao: result.intent.toLowerCase(),
      respostaEnviada: result.reply,
      eventoInicio: new Date(),
      eventoFim: new Date(),
    });
  }

  async handleRegistration(context, registration) {
    const { conversationId, message } = context;

    if (!message) {
      return this.sendText(conversationId, 'Pode me enviar essa informação por escrito?');
    }

    if (registration.step === 'waiting_name') {
      this.registrationSessions.set(conversationId, {
        ...registration,
        step: 'waiting_birth_date',
        name: message,
      });
      return this.sendText(conversationId, 'Obrigada! Qual é a sua data de nascimento? Pode enviar no formato dd/mm/aaaa.');
    }

    if (registration.step === 'waiting_birth_date') {
      if (!this.userService.isValidBirthDate(message)) {
        return this.sendText(conversationId, 'Não consegui reconhecer essa data. Pode enviar no formato dd/mm/aaaa?');
      }

      this.registrationSessions.set(conversationId, {
        ...registration,
        step: 'waiting_cpf',
        birthDate: message,
      });
      return this.sendText(conversationId, 'Certo. Agora me informe seu CPF, por favor.');
    }

    if (registration.step === 'waiting_cpf') {
      if (!this.userService.isValidCpf(message)) {
        return this.sendText(conversationId, 'Esse CPF parece estar incompleto. Pode conferir e enviar os 11 dígitos novamente?');
      }

      this.registrationSessions.set(conversationId, {
        ...registration,
        step: 'waiting_email',
        cpf: message,
      });
      return this.sendText(conversationId, 'Para finalizar, qual é o seu e-mail? Se preferir não informar, pode responder pular.');
    }

    if (registration.step === 'waiting_email') {
      const skipEmail = /^pular$/i.test(message);
      if (!skipEmail && !this.userService.isValidEmail(message)) {
        return this.sendText(conversationId, 'Não consegui reconhecer esse e-mail. Pode conferir ou responder pular?');
      }

      try {
        const { user, created } = await ValidationLog.measure('db.patient_registration', () => this.userService.createPatient({
          nome: registration.name,
          dataNascimento: registration.birthDate,
          cpf: registration.cpf,
          telefone: context.phone,
          email: skipEmail ? null : message,
        }));

        this.registrationSessions.delete(conversationId);
        await this.sendText(
          conversationId,
          created
            ? `Prontinho! Seu cadastro foi concluído com sucesso.`
            : `Prontinho! Seu cadastro foi atualizado.`
        );
        return this.sendText(
          conversationId,
          'Agora pode me contar como posso te ajudar.'
        );
      } catch (error) {
        console.error('Erro ao cadastrar paciente:', error.message);
        return this.sendText(
          conversationId,
          'Tive um problema para concluir o cadastro agora. Pode tentar novamente em alguns instantes?'
        );
      }
    }

    this.registrationSessions.delete(conversationId);
    return this.sendText(conversationId, 'Vamos recomeçar seu cadastro. Pode me enviar uma nova mensagem?');
  }

  async cancelCurrentInteraction(context) {
    await ValidationLog.record('flow.cancelled', { intent: this.activeFlows.get(context.conversationId) || 'OUTRO', status: 'cancelled' });
    this.registrationSessions.delete(context.conversationId);

    const activeIntent = this.activeFlows.get(context.conversationId);
    if (activeIntent) {
      this.flows.get(activeIntent)?.cancel(context);
      this.activeFlows.delete(context.conversationId);
    }

    return this.sendText(
      context.conversationId,
      'Tudo bem, cancelei por aqui. Quando quiser recomeçar, é só me chamar.'
    );
  }

  rememberConversation(conversationId, patientMessage, botReply) {
    const history = this.conversationHistory.get(conversationId) || [];

    if (patientMessage) {
      history.push({ role: 'patient', content: patientMessage });
    }

    history.push({ role: 'assistant', content: botReply });
    this.conversationHistory.set(conversationId, history.slice(-8));
  }

  isCancellation(message) {
    return /^(cancelar|cancelamento)$/i.test(message);
  }

  shouldSendReport(result) {
    return result.finished && result.reportable === true;
  }

  async publishCalendarEvent({ result, report, reportData, patient }) {
    const appointment = result.appointment || null;
    const appointmentDateTime = appointment?.dateTime || reportData.appointmentDateTime;

    if (!appointmentDateTime || !this.calendarService) {
      await ValidationLog.record('calendar.result', { status: 'skipped', reason: 'no_appointment_or_service' });
      return null;
    }

    if (typeof this.calendarService.createAppointmentEvent !== 'function') {
      return null;
    }

    try {
      const calendarResult = await ValidationLog.measure('calendar.publish', () => this.calendarService.createAppointmentEvent({
        patient,
        intent: result.intent,
        reportData,
        report,
        appointment,
      }));
      await ValidationLog.record('calendar.result', { status: calendarResult?.created ? 'created' : 'not_created',
        reason: ['disabled', 'without_appointment_date', 'already_exists'].includes(calendarResult?.status)
          ? calendarResult.status : 'service_result' });

      if (calendarResult?.created) {
        console.log(
          `Evento criado no Google Calendar: ${calendarResult.htmlLink || calendarResult.eventId}`
        );
      }

      return calendarResult;
    } catch (error) {
      await ValidationLog.record('calendar.result', { status: 'error', errorCode: ValidationLog.errorCode(error) });
      console.error('Erro ao criar evento no Google Calendar:', error.message);
      return null;
    }
  }

  async sendText(to, text) {
    return ValidationLog.measure('whatsapp.reply', () => this.sendMessage(to, { text }), { outputChars: String(text || '').length });
  }

  async logAttendanceReport({ report }) {
    console.log('\nRELATORIO PARA O DENTISTA:\n');
    console.log(report);
  }
}

module.exports = MessageHandler;
