'use strict';

const IntentTypes = require('../constants/IntentTypes');
const ProcedureCatalog = require('./ProcedureCatalog');
const ConversationTextService = require('./ConversationTextService');
const ApproximateTextService = require('./ApproximateTextService');

class FlowRouter {
  async route(message) {
    return this.detectByRegex(message) || IntentTypes.OUTRO;
  }

  detectByRegex(message) {
    const text = ProcedureCatalog.normalize(message);

    if (!text) return null;

    if (ConversationTextService.isGreeting(message)) {
      return IntentTypes.OUTRO;
    }

    if (/\b(humano|atendente|recepcionista|pessoa|falar com alguem|suporte)\b/.test(text)) {
      return IntentTypes.HUMANO;
    }

    if (/\b(orcamento|valor|preco|quanto custa|pagamento|pagar|parcela|parcelamento|juros|cartao|boleto|pix)\b/.test(text)) {
      return IntentTypes.FINANCEIRO;
    }

    if (/\b(historico|prontuario|anamnese|exame anterior|tratamento anterior|meus dados clinicos)\b/.test(text)) {
      return IntentTypes.HISTORICO;
    }

    if (/\b(dor|doendo|doi|inchaco|inchado|sangramento|sangrando|quebrou|quebrei|trincou|carie|sensibilidade|abscesso|ferida|trauma|dente mole)\b/.test(text)) {
      return IntentTypes.SINTOMA;
    }

    if (/\b(como funciona|o que e|qual a diferenca|onde fica|qual endereco|horario de funcionamento|como chegar|preparo)\b/.test(text)) {
      return IntentTypes.DUVIDA;
    }

    if (
      /\b(agendar|agendamen\w*|marcar|quero uma consulta|fazer uma consulta)\b/.test(
        text
      ) ||
      ApproximateTextService.containsAnyWord(text, [
        'agendamento',
        'agendar',
        'marcar',
      ])
    ) {
      return IntentTypes.AGENDAMENTO;
    }

    if (ProcedureCatalog.containsKnownProcedure(text)) {
      return IntentTypes.AGENDAMENTO;
    }

    return null;
  }
}

FlowRouter.INTENTS = IntentTypes;

module.exports = FlowRouter;
