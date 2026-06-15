let _sender = null;

class MessageService {
  static registerSender(senderFn) {
    _sender = senderFn;
  }

  static async send(to, message) {
    if (!_sender) throw new Error('Sender not registered in MessageService');
    return _sender(to, message);
  }
}

module.exports = MessageService;
