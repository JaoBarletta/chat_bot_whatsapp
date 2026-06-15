'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');

class HumanoFlow extends BaseFlow {
  constructor() {
    super(IntentTypes.HUMANO);
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
      reply: 'Claro! Vou chamar alguém da nossa equipe para continuar o atendimento com você.',
    };
  }
}

module.exports = HumanoFlow;
