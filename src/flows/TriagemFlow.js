'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');
const ConversationTextService = require('../services/ConversationTextService');
const ProcedureCatalog = require('../services/ProcedureCatalog');
const TriagemService = require('../services/TriagemService');
const DateParserService = require('../services/DateParserService');

class TriagemFlow extends BaseFlow {
  constructor({ agendamentoService } = {}) {
    super(IntentTypes.SINTOMA);
    this.agendamentoService =
      agendamentoService || require('../services/AgendamentoService');
  }

  async start(context) {
    const state = {
      step: 'waiting_time',
      complaint: String(context.message || '').trim(),
      symptomTime: null,
      location: null,
      characteristics: null,
      photoReceived: Boolean(context.hasImage),
      photo: context.media || null,
      complexity: 'BAIXA',
      date: null,
      time: null,
      availableSlots: [],
      offeredDates: [],
    };

    this.updateComplexity(state, context.message);
    this.setState(context.conversationId, state);

    return this.next('Há quanto tempo você está sentindo essa dor ou incômodo?');
  }

  async handle(context) {
    const state = this.getState(context.conversationId);
    const message = String(context.message || '').trim();

    if (!state) {
      return this.start(context);
    }

    if (context.hasImage) {
      state.photoReceived = true;
      state.photo = context.media || state.photo;
    }

    this.updateComplexity(state, message);

    if (state.step === 'waiting_time') {
      state.symptomTime = message;
      state.step = 'waiting_location';
      return this.next(
        'Certo. Você consegue identificar em qual dente ou região da boca está o problema?'
      );
    }

    if (state.step === 'waiting_location') {
      state.location = message;
      state.step = 'waiting_characteristics';
      return this.next(
        'Esse incômodo é constante ou aparece em algum momento específico, como ao mastigar ou tomar algo gelado?'
      );
    }

    if (state.step === 'waiting_characteristics') {
      state.characteristics = message;

      if (state.photoReceived) {
        return this.requestSchedulingDate(state);
      }

      state.step = 'waiting_photo';
      return this.next(
        'Se conseguir, pode me enviar uma foto da região? Se não der, tudo bem, é só me avisar.'
      );
    }

    if (state.step === 'waiting_photo') {
      if (context.hasImage) {
        state.photoReceived = true;
        return this.requestSchedulingDate(state);
      }

      if (this.isPhotoDeclined(message)) {
        state.photoReceived = false;
        return this.requestSchedulingDate(state);
      }

      return this.next(
        'Pode enviar a foto por aqui. Se não conseguir agora, é só me dizer que está sem foto.'
      );
    }

    if (state.step === 'waiting_date') {
      if (this.isSkipScheduling(message)) {
        return this.finish(context);
      }

      const dateResult = this.parseDate(message, state);

      if (dateResult.reason === 'past') {
        return this.next(
          'Essa data já passou. Você pode me informar uma data futura?'
        );
      }

      if (!dateResult.date) {
        if (this.isAvailabilityQuestion(message)) {
          return this.showNextAvailableDates(state);
        }

        return this.next(
          'Qual data você prefere? Pode enviar, por exemplo, 20/06/2026, dizer amanhã ou perguntar quais dias estão disponíveis.'
        );
      }

      let slots;
      try {
        slots = await this.loadAvailableSlots(dateResult.date);
      } catch (error) {
        console.error('Erro ao consultar horarios para triagem:', error.message);
        return this.next(
          'Não consegui consultar a agenda agora. Pode tentar novamente em alguns instantes?'
        );
      }

      if (slots.length === 0) {
        state.offeredDates = [];
        return this.next(
          'Não há horários livres nessa data. Pode me informar outro dia para eu consultar?'
        );
      }

      state.date = this.formatDate(dateResult.date);
      state.availableSlots = slots;
      state.offeredDates = [];
      state.step = 'waiting_time_slot';
      return this.next(
        `Para ${state.date}, os horários disponíveis são: ${slots.join(', ')}. Qual horário você prefere?`
      );
    }

    if (state.step === 'waiting_time_slot') {
      const time = this.parseTime(message);

      if (!time || !state.availableSlots.includes(time)) {
        return this.next(
          `Escolha um destes horários disponíveis para ${state.date}: ${state.availableSlots.join(', ')}.`
        );
      }

      state.time = time;
      state.step = 'waiting_confirmation';
      return this.next(
        `Só para confirmar sua preferência: avaliação no dia ${state.date} às ${state.time}. Está certo?`
      );
    }

    if (state.step === 'waiting_confirmation') {
      if (this.isAffirmative(message)) {
        return this.finish(context);
      }

      if (this.isNegativeOrReschedule(message)) {
        state.date = null;
        state.time = null;
        state.availableSlots = [];
        state.offeredDates = [];
        state.step = 'waiting_date';
        return this.next('Sem problema. Qual outra data você prefere?');
      }

      return this.next(
        'A data e o horário estão certos? Se quiser mudar, pode me informar outra opção.'
      );
    }

    return this.finish(context);
  }

  async finish(context) {
    const state = this.getState(context.conversationId);

    if (!state) {
      return {
        intent: this.intent,
        finished: true,
        reportable: false,
        reply: 'As informações já foram encaminhadas para a equipe avaliar.',
      };
    }

    const patient = context.patient?.dataValues || context.patient || {};
    const appointmentDate =
      state.date && state.time ? `${state.date} às ${state.time}` : null;

    if (appointmentDate) {
      try {
        await this.agendamentoService.createAppointment({
          idUsuario: patient.id,
          telefone: patient.telefone,
          dataHorario: this.toAppointmentDate(state.date, state.time),
          tipoProcedimento: 'Avaliacao',
          anamnese: TriagemService.createAnamneseFromAnswers({
            origem: 'triagem',
            queixa_principal: state.complaint,
            tempo_sintoma: state.symptomTime,
            localizacao: state.location,
            caracteristicas: state.characteristics,
            complexidade: state.complexity,
          }),
        });
      } catch (error) {
        if (error.code === 'SLOT_UNAVAILABLE') {
          state.date = null;
          state.time = null;
          state.availableSlots = [];
          state.offeredDates = [];
          state.step = 'waiting_date';
          return this.next(
            'Esse horário acabou de ficar indisponível. Qual outra data você prefere?'
          );
        }

        console.error('Erro ao registrar preferencia da triagem:', error.message);
        return this.next(
          'Não consegui registrar esse horário agora. Pode confirmar novamente em alguns instantes?'
        );
      }
    }

    const report = TriagemService.buildStructuredReport({
      patientName: patient.nome,
      phone: patient.telefone,
      complaint: state.complaint,
      symptomTime: state.symptomTime,
      location: state.location,
      characteristics: state.characteristics,
      photoReceived: state.photoReceived,
      complexity: state.complexity,
    });

    this.clearState(context.conversationId);

    return {
      intent: this.intent,
      finished: true,
      reportable: true,
      allowHumanization: false,
      report,
      reportData: {
        complaint: state.complaint,
        need: `Avaliação odontológica: ${state.complaint}`,
        complexity: state.complexity,
        characteristics: {
          symptomTime: state.symptomTime,
          location: state.location,
          description: state.characteristics,
          complexity: state.complexity,
        },
        photo: state.photo,
        photoReceived: state.photoReceived,
        appointmentDate,
      },
      reply: appointmentDate
        ? [
            `Obrigada. Registrei suas informações e a preferência para ${appointmentDate}.`,
            'A equipe vai avaliar o caso e confirmar o atendimento com você por aqui.',
          ].join('\n\n')
        : [
            'Obrigada. As informações foram registradas e encaminhadas para avaliação do dentista.',
            'A equipe entrará em contato para orientar o atendimento e combinar o agendamento.',
          ].join('\n\n'),
    };
  }

  requestSchedulingDate(state) {
    state.offeredDates = [];
    state.step = 'waiting_date';
    return this.next(
      'Agora, para registrarmos sua preferência de atendimento, qual data fica melhor para você? Se preferir decidir depois, é só me avisar.'
    );
  }

  async showNextAvailableDates(state) {
    try {
      state.offeredDates = [];
      if (typeof this.agendamentoService.getNextAvailableDates !== 'function') {
        return this.next(
          'Pode me informar uma data de preferência para eu consultar os horários?'
        );
      }

      const dates = await this.agendamentoService.getNextAvailableDates(
        new Date(),
        { daysAhead: 30, limit: 5 }
      );
      state.offeredDates = dates.map((item) => item.date);
      const formatted = dates.map((item) => item.date).join(', ');

      return this.next(
        formatted
          ? `As próximas datas com disponibilidade são: ${formatted}. Qual delas fica melhor para você?`
          : 'Não encontrei horários livres nos próximos dias. A equipe vai verificar a agenda e retornar por aqui.'
      );
    } catch (error) {
      console.error('Erro ao consultar datas para triagem:', error.message);
      return this.next(
        'Não consegui consultar a agenda agora. Pode me informar uma data de preferência?'
      );
    }
  }

  async loadAvailableSlots(date) {
    if (typeof this.agendamentoService.getAvailableSlots === 'function') {
      return this.agendamentoService.getAvailableSlots(date);
    }

    return Array.from(
      { length: 12 },
      (_, index) => `${String(index + 8).padStart(2, '0')}:00`
    );
  }

  parseDate(value, state = {}) {
    return DateParserService.parse(value, {
      offeredDates: state.offeredDates,
    });
  }

  parseTime(value) {
    const text = ProcedureCatalog.normalize(value);
    const match = text.match(
      /\b([01]?\d|20)(?::([0-5]\d))?\s*(?:h|horas?)?\b/
    );
    if (!match) return null;

    return `${String(Number(match[1])).padStart(2, '0')}:${String(
      Number(match[2] || 0)
    ).padStart(2, '0')}`;
  }

  toAppointmentDate(date, time) {
    const [day, month, year] = String(date).split('/').map(Number);
    const [hour, minute] = String(time).split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  formatDate(date) {
    return DateParserService.format(date);
  }

  isPhotoDeclined(message) {
    const text = ConversationTextService.normalize(message);
    if (
      /^(nao|n|pular|nao consigo|nao posso|nao tenho como|nao da|nao vou conseguir|prefiro nao)(?: agora)?$/.test(
        text
      )
    ) {
      return true;
    }

    return [
      /\bsem (?:uma )?(?:foto|imagem)\b/,
      /\bnao (?:consigo|posso|vou conseguir|tenho como|quero)\b.*\b(?:foto|imagem)\b/,
      /\bprefiro nao\b.*\b(?:enviar|mandar|tirar|fazer|encaminhar)?\b.*\b(?:foto|imagem)\b/,
      /\bnao (?:da|tem como)\b.*\b(?:tirar|fazer|enviar|mandar|encaminhar)\b/,
      /\bnao (?:consigo|posso)\b.*\b(?:tirar|fazer|enviar|mandar|encaminhar)\b/,
      /\b(?:camera|camera do celular) (?:nao funciona|esta quebrada)\b/,
    ].some((pattern) => pattern.test(text));
  }

  isSkipScheduling(message) {
    const text = ConversationTextService.normalize(message);
    return /\b(nao quero agendar|sem agendamento|decido depois|depois eu vejo|agora nao|pular)\b/.test(
      text
    );
  }

  isAvailabilityQuestion(message) {
    const text = ProcedureCatalog.normalize(message);
    return /\b(quais dias|dias disponiveis|tem disponibilidade|quando tem vaga|essa semana|esta semana|proxima semana|semana que vem|proximos dias)\b/.test(
      text
    );
  }

  isAffirmative(message) {
    const text = ConversationTextService.normalize(message);
    return /\b(sim|ok|confirmo|certo|correto|esta certo|tudo certo)\b/.test(
      text
    );
  }

  isNegativeOrReschedule(message) {
    return /\b(nao|remarcar|trocar|outra data|outro horario)\b/.test(
      ConversationTextService.normalize(message)
    );
  }

  next(reply) {
    return {
      intent: this.intent,
      finished: false,
      allowHumanization: false,
      reply,
    };
  }

  updateComplexity(state, message) {
    const text = TriagemService.normalize(message);
    const hasStrongPain =
      /\bdor\b/.test(text) &&
      /\b(muito forte|fortissima|intensa|insuportavel)\b/.test(text);
    const hasHighComplexitySigns =
      hasStrongPain ||
      /\b(febre|rosto inchado|inchaco grande|sangramento intenso|trauma|batida|dificuldade para respirar|dificuldade para engolir)\b/.test(
        text
      );

    if (hasHighComplexitySigns) {
      state.complexity = 'ALTA';
      return;
    }

    if (
      state.complexity !== 'ALTA' &&
      /\b(dor|doendo|inchaco|sangramento|dente quebrado|sensibilidade|ferida)\b/.test(
        text
      )
    ) {
      state.complexity = 'MEDIA';
    }
  }
}

module.exports = TriagemFlow;
