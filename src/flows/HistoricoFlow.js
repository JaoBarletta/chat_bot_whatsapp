'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');

class HistoricoFlow extends BaseFlow {
  constructor() {
    super(IntentTypes.HISTORICO);
  }

  async start(context) {
    return this.finish(context);
  }

  async handle(context) {
    return this.finish(context);
  }

  async finish({ conversationId }) {
    this.clearState(conversationId);
    return {
      intent: this.intent,
      finished: true,
      reportable: true,
      reply: 'Claro! Vou pedir para a equipe verificar seu histórico e te retornar por aqui.',
    };
  }
}

module.exports = HistoricoFlow;
