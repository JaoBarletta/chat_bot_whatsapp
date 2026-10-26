'use strict';
const ValidationLog = require('./ValidationLogService');

class IncomingMessageBuffer {
  constructor({
    processMessage,
    waitMs = 3000,
    onError = async () => {},
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = {}) {
    if (typeof processMessage !== 'function') {
      throw new Error('IncomingMessageBuffer requer uma funcao processMessage.');
    }

    this.processMessage = processMessage;
    this.waitMs = IncomingMessageBuffer.normalizeWaitMs(waitMs);
    this.onError = onError;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.pending = new Map();
    this.processing = new Map();
  }

  enqueue({
    conversationId,
    phone,
    message = '',
    hasImage = false,
    media = null,
  }) {
    if (!conversationId) {
      throw new Error('conversationId e obrigatorio para agrupar mensagens.');
    }

    const current = this.pending.get(conversationId) || {
      conversationId,
      phone,
      fragments: [],
      hasImage: false,
      media: null,
      timer: null,
      firstReceivedAt: Date.now(),
    };

    if (current.timer) {
      this.clearTimer(current.timer);
    }

    const text = String(message || '').trim();
    if (text) {
      current.fragments.push(text);
    }

    current.phone = phone || current.phone;
    current.hasImage = current.hasImage || Boolean(hasImage);
    current.media = media || current.media;
    current.timer = this.setTimer(() => {
      void this.flush(conversationId);
    }, this.waitMs);

    this.pending.set(conversationId, current);
  }

  async flush(conversationId) {
    const batch = this.pending.get(conversationId);
    if (!batch) return null;

    this.pending.delete(conversationId);
    if (batch.timer) {
      this.clearTimer(batch.timer);
    }

    const payload = {
      conversationId: batch.conversationId,
      phone: batch.phone,
      message: batch.fragments.join(' '),
      hasImage: batch.hasImage,
      media: batch.media,
    };

    const previous = this.processing.get(conversationId) || Promise.resolve();
    const queuedAt = Date.now();
    const processing = previous
      .catch(() => {})
      .then(async () => {
        await ValidationLog.run(conversationId, () => ValidationLog.record('message.buffer', {
          fragmentCount: batch.fragments.length, hasImage: batch.hasImage,
          bufferMs: queuedAt - batch.firstReceivedAt, queueMs: Date.now() - queuedAt,
          status: 'flushed',
        }));
        return this.processMessage(payload);
      });

    this.processing.set(conversationId, processing);

    try {
      return await processing;
    } catch (error) {
      await this.onError(error, payload);
      return null;
    } finally {
      if (this.processing.get(conversationId) === processing) {
        this.processing.delete(conversationId);
      }
    }
  }

  static normalizeWaitMs(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3000;
  }
}

module.exports = IncomingMessageBuffer;
