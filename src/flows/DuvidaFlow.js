'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');

class DuvidaFlow extends BaseFlow {
  constructor() {
    super(IntentTypes.DUVIDA);
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
      reply: 'Entendi! Vou confirmar essa informação com a equipe e te respondo por aqui.',
    };
  }
}

module.exports = DuvidaFlow;
