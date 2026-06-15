'use strict';

class BaseFlow {
  constructor(intent) {
    this.intent = intent;
    this.sessions = new Map();
  }

  hasSession(conversationId) {
    return this.sessions.has(conversationId);
  }

  getState(conversationId) {
    return this.sessions.get(conversationId) || null;
  }

  setState(conversationId, state) {
    this.sessions.set(conversationId, state);
    return state;
  }

  clearState(conversationId) {
    this.sessions.delete(conversationId);
  }

  cancel({ conversationId }) {
    this.clearState(conversationId);
    return {
      intent: this.intent,
      finished: true,
      reply: 'Fluxo cancelado. Envie uma nova mensagem para recomecar.',
    };
  }

  async start() {
    throw new Error('start() deve ser implementado pelo Flow.');
  }

  async handle() {
    throw new Error('handle() deve ser implementado pelo Flow.');
  }

  async finish() {
    throw new Error('finish() deve ser implementado pelo Flow.');
  }
}

module.exports = BaseFlow;
