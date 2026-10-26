'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');
const ProcedureCatalog = require('../services/ProcedureCatalog');
const ProcedureComplexityService = require('../services/ProcedureComplexityService');
const ConversationTextService = require('../services/ConversationTextService');
const TriagemService = require('../services/TriagemService');
const DateParserService = require('../services/DateParserService');
const TimeParserService = require('../services/TimeParserService');

class AgendamentoFlow extends BaseFlow {
  constructor({ agendamentoService, anamneseService } = {}) {
    super(IntentTypes.AGENDAMENTO);
    this.agendamentoService =
      agendamentoService || require('../services/AgendamentoService');
    this.anamneseService =
      anamneseService || require('../services/AnamneseService');
  }

  async start(context) {
    const procedure = this.extractSchedulingProcedure(context.message);
    const state = {
      step: 'waiting_procedure',
      procedure,
      need: null,
      complexity: null,
      anamnesis: this.createEmptyAnamnesis(),
      date: null,
      time: null,
      availableSlots: [],
      offeredDates: [],
      reason: null,
    };

    if (procedure) {
      this.configureNextStep(state);
    }

    this.setState(context.conversationId, state);

    return {
      intent: this.intent,
      finished: false,
      reply: this.buildStartReply({ state }),
    };
  }

  async handle(context) {
    const state = this.getState(context.conversationId);
    const message = String(context.message || '').trim();

    if (!state) {
      return this.start(context);
    }

    if (state.step === 'waiting_procedure') {
      const procedure = this.extractSchedulingProcedure(message);

      if (!procedure) {
        return this.next(
          'Sem problema. Você sabe me dizer qual atendimento procura? Se estiver sentindo dor ou algum incômodo, pode me contar.'
        );
      }

      state.procedure = procedure;
      this.configureNextStep(state);
      return this.next(this.buildStepReply(state));
    }

    if (state.step === 'waiting_need') {
      const complexity = ProcedureComplexityService.classify({
        procedure: null,
        need: message,
      });

      if (!complexity) {
        return this.next(
          'Para eu direcionar certinho, você procura uma avaliação de rotina ou já tem algum procedimento em mente?'
        );
      }

      state.need = message;
      state.complexity = complexity;
      state.step = ProcedureComplexityService.requiresAnamnesis(complexity)
        ? 'waiting_anamnesis_diabetes'
        : 'waiting_date';

      return this.next(this.buildStepReply(state));
    }

    const anamnesisResult = this.handleAnamnesisStep(state, message);
    if (anamnesisResult) {
      return anamnesisResult;
    }

    if (state.step === 'waiting_date') {
      return this.handleDateStep(state, message);
    }

    if (state.step === 'waiting_time') {
      return this.handleTimeStep(state, message);
    }

    if (state.step === 'waiting_confirmation') {
      if (this.isAffirmative(message)) {
        return this.finish(context);
      }

      if (/^(cancelar|cancelamento)$/i.test(message)) {
        return this.cancel(context);
      }

      if (this.isNegativeOrReschedule(message)) {
        this.resetScheduleSelection(state);
        return this.next(
          'Sem problema. Qual outra data fica melhor para você?'
        );
      }

      return this.next(
        'Só para eu confirmar: a data e o horário estão certos? Se quiser mudar, pode me avisar.'
      );
    }

    return this.cancel(context);
  }

  handleAnamnesisStep(state, message) {
    const booleanSteps = {
      waiting_anamnesis_diabetes: {
        field: 'diabetes',
        nextStep: 'waiting_anamnesis_hypertension',
        nextReply: 'Você tem hipertensão ou pressão alta?',
      },
      waiting_anamnesis_hypertension: {
        field: 'hypertension',
        nextStep: 'waiting_anamnesis_heart',
        nextReply: 'Tem algum problema cardíaco ou faz acompanhamento com cardiologista?',
      },
      waiting_anamnesis_heart: {
        field: 'heartProblems',
        nextStep: 'waiting_anamnesis_systemic',
        nextReply: 'Possui alguma doença sistêmica ou condição importante, como problema renal, hepático, imunológico ou alteração de coagulação?',
      },
      waiting_anamnesis_transfusion: {
        field: 'bloodTransfusion',
        nextStep: 'waiting_anamnesis_transplant',
        nextReply: 'Já realizou transplante de órgão?',
      },
      waiting_anamnesis_transplant: {
        field: 'transplant',
        nextStep: 'waiting_anamnesis_allergy',
        nextReply: 'Tem alergia a algum medicamento?',
        trueStep: 'waiting_anamnesis_transplant_type',
        trueReply: 'Qual órgão foi transplantado?',
      },
      waiting_anamnesis_allergy: {
        field: 'medicationAllergy',
        nextStep: 'waiting_anamnesis_anesthetic',
        nextReply: 'Já teve alguma reação, mal-estar ou dificuldade com anestesia odontológica?',
        trueStep: 'waiting_anamnesis_allergy_details',
        trueReply: 'A quais medicamentos você tem alergia?',
      },
    };

    const booleanStep = booleanSteps[state.step];
    if (booleanStep) {
      return this.handleBooleanAnamnesisAnswer(state, message, booleanStep);
    }

    if (state.step === 'waiting_anamnesis_systemic') {
      return this.handleOptionalDetailAnswer(state, message, {
        field: 'systemicDiseases',
        detailStep: 'waiting_anamnesis_systemic_details',
        detailReply: 'Qual doença sistêmica ou condição você possui?',
        nextStep: 'waiting_anamnesis_transfusion',
        nextReply: 'Já realizou transfusão de sangue?',
      });
    }

    if (state.step === 'waiting_anamnesis_systemic_details') {
      state.anamnesis.systemicDiseases = this.normalizeRequiredAnswer(message);
      if (!state.anamnesis.systemicDiseases) {
        return this.next('Pode me informar qual doença ou condição você possui?');
      }

      state.step = 'waiting_anamnesis_transfusion';
      return this.next('Já realizou transfusão de sangue?');
    }

    if (state.step === 'waiting_anamnesis_transplant_type') {
      state.anamnesis.transplantType = this.normalizeRequiredAnswer(message);
      if (!state.anamnesis.transplantType) {
        return this.next('Pode me informar qual órgão foi transplantado?');
      }

      state.step = 'waiting_anamnesis_allergy';
      return this.next('Tem alergia a algum medicamento?');
    }

    if (state.step === 'waiting_anamnesis_allergy_details') {
      state.anamnesis.allergicMedications = this.normalizeRequiredAnswer(message);
      if (!state.anamnesis.allergicMedications) {
        return this.next('Pode me dizer o nome do medicamento que causa alergia?');
      }

      state.step = 'waiting_anamnesis_anesthetic';
      return this.next(
        'Já teve alguma reação, mal-estar ou dificuldade com anestesia odontológica?'
      );
    }

    if (state.step === 'waiting_anamnesis_anesthetic') {
      return this.handleOptionalDetailAnswer(state, message, {
        field: 'anestheticObservations',
        detailStep: 'waiting_anamnesis_anesthetic_details',
        detailReply: 'Pode me contar qual reação ou dificuldade ocorreu com a anestesia?',
        nextStep: 'waiting_anamnesis_other',
        nextReply: 'Há outra informação importante para o dentista, como gestação, uso de anticoagulante, sangramento excessivo ou dificuldade de cicatrização?',
      });
    }

    if (state.step === 'waiting_anamnesis_anesthetic_details') {
      state.anamnesis.anestheticObservations =
        this.normalizeRequiredAnswer(message);
      if (!state.anamnesis.anestheticObservations) {
        return this.next('Pode me contar o que aconteceu com a anestesia?');
      }

      state.step = 'waiting_anamnesis_other';
      return this.next(
        'Há outra informação importante para o dentista, como gestação, uso de anticoagulante, sangramento excessivo ou dificuldade de cicatrização?'
      );
    }

    if (state.step === 'waiting_anamnesis_other') {
      return this.handleOptionalDetailAnswer(state, message, {
        field: 'otherConditions',
        detailStep: 'waiting_anamnesis_other_details',
        detailReply: 'Pode me contar qual é essa outra condição ou informação?',
        nextStep: 'waiting_date',
        nextReply: 'Obrigada pelas informações. Agora me diga qual data você prefere para eu consultar os horários disponíveis.',
      });
    }

    if (state.step === 'waiting_anamnesis_other_details') {
      state.anamnesis.otherConditions = this.normalizeRequiredAnswer(message);
      if (!state.anamnesis.otherConditions) {
        return this.next('Pode me contar qual é essa condição ou informação?');
      }

      state.step = 'waiting_date';
      return this.next(
        'Obrigada pelas informações. Agora me diga qual data você prefere para eu consultar os horários disponíveis.'
      );
    }

    return null;
  }

  handleBooleanAnamnesisAnswer(state, message, step) {
    const answer = this.parseBooleanAnswer(message);
    if (answer === null) {
      return this.next('Para eu registrar corretamente, pode responder sim ou não?');
    }

    state.anamnesis[step.field] = answer;
    state.step = answer && step.trueStep ? step.trueStep : step.nextStep;
    return this.next(answer && step.trueReply ? step.trueReply : step.nextReply);
  }

  handleOptionalDetailAnswer(state, message, {
    field,
    detailStep,
    detailReply,
    nextStep,
    nextReply,
  }) {
    const answer = this.parseBooleanAnswer(message);

    if (answer === true) {
      state.step = detailStep;
      return this.next(detailReply);
    }

    state.anamnesis[field] =
      answer === false ? null : this.normalizeRequiredAnswer(message);
    state.step = nextStep;
    return this.next(nextReply);
  }

  async handleDateStep(state, message) {
    const dateResult = this.parseDate(message, state);

    if (dateResult.reason === 'past') {
      return this.next(
        'Essa data já passou. Você pode me informar uma data futura?'
      );
    }

    if (!dateResult.date) {
      if (this.isAvailabilityQuestion(message)) {
        return this.buildAvailableDatesReply(state);
      }

      return this.next(
        'Não consegui entender a data. Você pode me mandar, por exemplo, 20/06/2026, dizer amanhã ou perguntar quais dias estão disponíveis.'
      );
    }

    let slots;
    try {
      slots = await this.loadAvailableSlots(dateResult.date);
    } catch (error) {
      console.error('Erro ao consultar horarios disponiveis:', error.message);
      return this.next(
        'Não consegui consultar a agenda agora. Pode tentar novamente em alguns instantes?'
      );
    }

    if (slots.length === 0) {
      const alternatives = await this.loadNextAvailableDates(
        this.addDays(dateResult.date, 1)
      );
      state.offeredDates = alternatives.map((item) => item.date);
      const alternativeText = this.formatAvailableDates(alternatives);
      return this.next(
        alternativeText
          ? `Não há horários livres nessa data. As próximas datas com disponibilidade são: ${alternativeText}. Qual delas fica melhor para você?`
          : 'Não há horários livres nessa data. Pode me informar outra data para eu consultar?'
      );
    }

    state.date = this.formatDate(dateResult.date);
    state.availableSlots = slots;
    state.offeredDates = [];
    state.step = 'waiting_time';

    return this.next(
      `Para ${state.date}, os horários disponíveis são: ${this.formatSlots(slots)}. Qual horário você prefere?`
    );
  }

  async handleTimeStep(state, message) {
    const time = this.parseTime(message, state.availableSlots);
    if (time && state.availableSlots.includes(time)) {
      state.time = time;
      state.step = 'waiting_confirmation';
      return this.next(this.buildConfirmation(state));
    }

    const period = this.normalizePeriod(message);
    if (period) {
      const periodSlots = this.filterSlotsByPeriod(state.availableSlots, period);
      return this.next(
        periodSlots.length > 0
          ? `Nesse período tenho: ${this.formatSlots(periodSlots)}. Qual horário você prefere?`
          : `Não há horários livres nesse período. Para ${state.date}, ainda tenho: ${this.formatSlots(state.availableSlots)}.`
      );
    }

    if (!time) {
      return this.next(
        `Não consegui identificar o horário. Para ${state.date}, escolha uma destas opções: ${this.formatSlots(state.availableSlots)}.`
      );
    }

    if (!state.availableSlots.includes(time)) {
      return this.next(
        `Esse horário não está disponível. Para ${state.date}, ainda tenho: ${this.formatSlots(state.availableSlots)}. Qual você prefere?`
      );
    }

    state.time = time;
    state.step = 'waiting_confirmation';
    return this.next(this.buildConfirmation(state));
  }

  async buildAvailableDatesReply(state) {
    try {
      state.offeredDates = [];
      const availableDates = await this.loadNextAvailableDates(new Date());
      state.offeredDates = availableDates.map((item) => item.date);
      const dates = this.formatAvailableDates(availableDates);

      return this.next(
        dates
          ? `As próximas datas com horários disponíveis são: ${dates}. Qual delas fica melhor para você?`
          : 'Não encontrei horários livres nos próximos dias. Vou pedir para a equipe verificar a agenda e retornar por aqui.'
      );
    } catch (error) {
      console.error('Erro ao consultar datas disponiveis:', error.message);
      return this.next(
        'Não consegui consultar a agenda agora. Pode me informar uma data de preferência para tentarmos novamente?'
      );
    }
  }

  async finish(context) {
    const state = this.getState(context.conversationId);

    if (!state) {
      return {
        intent: this.intent,
        finished: true,
        reportable: false,
        reply: 'Esse agendamento já foi encerrado. Se precisar marcar outro, é só me avisar.',
      };
    }

    const patient = context.patient?.dataValues || context.patient || {};
    state.procedure = ProcedureCatalog.canonicalize(state.procedure);
    const dataHorario = this.toAppointmentDate(state.date, state.time);
    const requiresAnamnesis = ProcedureComplexityService.requiresAnamnesis(
      state.complexity
    );
    const observacoes = TriagemService.createAnamneseFromAnswers({
      procedimento: state.procedure,
      necessidade_consulta: state.need,
      complexidade: state.complexity,
      horario: state.time,
      anamnese_realizada: requiresAnamnesis,
      ...state.anamnesis,
    });

    let appointment = null;
    try {
      if (requiresAnamnesis) {
        await this.anamneseService.saveForPatient({
          patientId: patient.id,
          anamnesis: state.anamnesis,
        });
      }

      appointment = await this.agendamentoService.createAppointment({
        idUsuario: patient.id,
        telefone: patient.telefone,
        dataHorario,
        tipoProcedimento: state.procedure,
        anamnese: observacoes,
      });
    } catch (error) {
      if (error.code === 'SLOT_UNAVAILABLE') {
        this.resetScheduleSelection(state);
        return this.next(
          'Esse horário acabou de ficar indisponível. Me informe outra data para eu consultar novamente.'
        );
      }

      console.error('Erro ao registrar agendamento:', error.message);
      return this.next(
        'Tive um problema para registrar agora. Pode confirmar novamente daqui a alguns instantes?'
      );
    }

    const appointmentData = appointment?.dataValues || appointment || {};
    this.clearState(context.conversationId);
    return {
      intent: this.intent,
      finished: true,
      reportable: true,
      appointment: {
        id: appointmentData.id || null,
        dateTime: dataHorario,
        durationMinutes: appointmentData.duracao_min || null,
        procedure: state.procedure,
        need: state.need,
        complexity: state.complexity,
        status: 'pendente',
      },
      reportData: {
        complaint: state.need || state.procedure,
        need: state.need,
        procedure: state.procedure,
        complexity: state.complexity,
        anamnesis: state.anamnesis,
        appointmentDate: `${state.date} às ${state.time}`,
        appointmentDateTime: dataHorario,
        durationMinutes: appointmentData.duracao_min || null,
      },
      reply: `Prontinho! Registrei sua solicitação para ${state.date} às ${state.time}. A equipe vai conferir e confirmar o horário com você por aqui.`,
    };
  }

  buildConfirmation(state) {
    const need = state.need ? ` Motivo: ${state.need}.` : '';
    return `Só para confirmar sua solicitação: ${state.procedure} no dia ${state.date} às ${state.time}.${need} Está tudo certo?`;
  }

  toAppointmentDate(date, time) {
    const [day, month, year] = String(date).split('/').map(Number);
    const [hour, minute] = String(time).split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  parseDate(value, state = {}) {
    return DateParserService.parse(value, {
      offeredDates: state.offeredDates,
    });
  }

  parseTime(value, availableSlots = []) {
    return TimeParserService.parse(value, { availableSlots });
  }

  formatDate(date) {
    return DateParserService.format(date);
  }

  normalizePeriod(message) {
    const text = ConversationTextService.normalize(message);
    if (/\bmanha\b/.test(text)) return 'manha';
    if (/\btarde\b/.test(text)) return 'tarde';
    if (/\bnoite\b/.test(text)) return 'noite';
    return null;
  }

  isAffirmative(message) {
    const text = ConversationTextService.normalize(message);
    if (/\b(nao|cancelar|remarcar|trocar)\b/.test(text)) return false;
    return /\b(sim|ok|okay|confirmo|pode confirmar|certo|certinho|correto|esta certo|ta certo|tudo certo|isso|isso mesmo|pode ser|beleza|combinado|fechado|perfeito|tranquilo)\b/.test(
      text
    );
  }

  isNegativeOrReschedule(message) {
    return /\b(nao|remarcar|trocar|outra data|outro horario)\b/.test(
      ConversationTextService.normalize(message)
    );
  }

  configureNextStep(state) {
    if (this.isGenericConsultation(state.procedure)) {
      state.step = 'waiting_need';
      return;
    }

    state.complexity = ProcedureComplexityService.classify({
      procedure: state.procedure,
    });
    state.step = ProcedureComplexityService.requiresAnamnesis(state.complexity)
      ? 'waiting_anamnesis_diabetes'
      : 'waiting_date';
  }

  buildStartReply({ state }) {
    if (!state.procedure) {
      return 'Certo. Você já sabe qual procedimento quer agendar?';
    }

    if (state.step === 'waiting_need') {
      return 'Antes de escolhermos a data da consulta, pode me contar o motivo do atendimento?';
    }

    if (state.step === 'waiting_anamnesis_diabetes') {
      return `Antes de escolhermos a data para ${state.procedure}, preciso fazer uma breve anamnese odontológica. Você tem diabetes?`;
    }

    return `Vamos marcar ${state.procedure}. Qual data você prefere para eu consultar os horários disponíveis?`;
  }

  buildStepReply(state) {
    if (state.step === 'waiting_need') {
      return 'Antes de escolhermos a data, pode me contar qual é a necessidade dessa consulta?';
    }

    if (state.step === 'waiting_anamnesis_diabetes') {
      return 'Entendi. Antes de escolhermos a data, preciso fazer uma breve anamnese odontológica. Você tem diabetes?';
    }

    return `Perfeito! Qual data você prefere para agendarmos ${state.procedure}?`;
  }

  async loadAvailableSlots(date) {
    if (typeof this.agendamentoService.getAvailableSlots === 'function') {
      return this.agendamentoService.getAvailableSlots(date);
    }

    return this.defaultAvailableSlots();
  }

  async loadNextAvailableDates(date) {
    if (typeof this.agendamentoService.getNextAvailableDates === 'function') {
      return this.agendamentoService.getNextAvailableDates(date);
    }

    return Array.from({ length: 5 }, (_, index) => {
      const itemDate = this.addDays(date, index);
      return {
        date: this.formatDate(itemDate),
        slots: this.defaultAvailableSlots(),
      };
    });
  }

  defaultAvailableSlots() {
    return Array.from(
      { length: 12 },
      (_, index) => `${String(index + 8).padStart(2, '0')}:00`
    );
  }

  formatSlots(slots) {
    return slots.join(', ');
  }

  formatAvailableDates(availableDates) {
    return availableDates.map((item) => item.date).join(', ');
  }

  filterSlotsByPeriod(slots, period) {
    return slots.filter((slot) => {
      const hour = Number(slot.split(':')[0]);
      if (period === 'manha') return hour < 12;
      if (period === 'tarde') return hour >= 12 && hour < 18;
      return hour >= 18;
    });
  }

  parseBooleanAnswer(message) {
    const text = ConversationTextService.normalize(message);
    if (/\b(nao|nunca|nenhum|nenhuma)\b/.test(text)) return false;
    if (/\b(sim|tenho|possuo|ja fiz|ja realizei|sou)\b/.test(text)) return true;
    return null;
  }

  normalizeRequiredAnswer(message) {
    const value = String(message || '').trim();
    return value || null;
  }

  createEmptyAnamnesis() {
    return {
      diabetes: null,
      hypertension: null,
      heartProblems: null,
      systemicDiseases: null,
      bloodTransfusion: null,
      transplant: null,
      transplantType: null,
      medicationAllergy: null,
      allergicMedications: null,
      anestheticObservations: null,
      otherConditions: null,
    };
  }

  resetScheduleSelection(state) {
    state.date = null;
    state.time = null;
    state.availableSlots = [];
    state.offeredDates = [];
    state.step = 'waiting_date';
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  next(reply) {
    return {
      intent: this.intent,
      finished: false,
      reply,
    };
  }

  extractSchedulingProcedure(message) {
    const procedures = ProcedureCatalog.extractAll(message);
    const specificProcedure = procedures.find(
      (procedure) => !this.isGenericConsultation(procedure)
    );
    return ProcedureCatalog.canonicalize(specificProcedure || procedures[0]);
  }

  isGenericConsultation(procedure) {
    return ['Consulta', 'Avaliacao'].includes(procedure);
  }

  isAvailabilityQuestion(message) {
    const text = ProcedureCatalog.normalize(message);
    return /\b(que dias|quais dias|quais datas|datas disponiveis|dias disponiveis|proximas datas|tem disponivel|tem disponibilidade|qual disponibilidade|quais horarios|horarios disponiveis|quando tem vaga|tem vaga|essa semana|esta semana|proxima semana|semana que vem|proximos dias)\b/.test(
      text
    );
  }

}

module.exports = AgendamentoFlow;
