'use strict';

const ProcedureCatalog = require('./ProcedureCatalog');

class ConversationTextService {
  static normalize(message) {
    return ProcedureCatalog.normalize(message)
      .replace(/[!?.,;:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static isGreeting(message) {
    const text = ConversationTextService.normalize(message);

    return /^(?:(?:oi+|ola+|opa|bom dia|boa tarde|boa noite|e ai|tudo bem|tudo certo)\s*)+$/.test(text);
  }
}

module.exports = ConversationTextService;
