'use strict';

const BaseFlow = require('./BaseFlow');
const IntentTypes = require('../constants/IntentTypes');
const ConversationTextService = require('../services/ConversationTextService');

class OutroFlow extends BaseFlow {
  constructor() {
    super(IntentTypes.OUTRO);
  }

  async start(context) {
    return this.finish(context);
  }

  async handle(context) {
    return this.finish(context);
  }

  async finish({ conversationId, message, patient }) {
    this.clearState(conversationId);
    const name = patient?.nome || patient?.dataValues?.nome;
    const isGreeting = ConversationTextService.isGreeting(message);

    return {
      intent: this.intent,
      finished: true,
      reportable: false,
      reply: isGreeting
        ? `Oi${name ? `, ${this.firstName(name)}` : ''}! Tudo bem? O que você precisa hoje?`
        : 'Não entendi muito bem. Você pode me explicar de outro jeito?',
    };
  }

  firstName(name) {
    return String(name || '').trim().split(/\s+/)[0];
  }
}

module.exports = OutroFlow;
