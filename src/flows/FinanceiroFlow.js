'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');

class FinanceiroFlow extends BaseFlow {
  constructor() {
    super(IntentTypes.FINANCEIRO);
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
      reply: 'Claro! Como os valores podem variar conforme cada caso, vou pedir para a equipe verificar certinho e te passar as informações pelo WhatsApp.',
    };
  }
}

module.exports = FinanceiroFlow;
