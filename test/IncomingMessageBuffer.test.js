'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const IncomingMessageBuffer = require('../src/services/IncomingMessageBuffer');

test('agrupa mensagens fragmentadas e processa somente depois da espera', async () => {
  const processed = [];
  const clearedTimers = [];
  let timerId = 0;

  const buffer = new IncomingMessageBuffer({
    processMessage: async (payload) => processed.push(payload),
    waitMs: 3000,
    setTimer() {
      timerId += 1;
      return timerId;
    },
    clearTimer(id) {
      clearedTimers.push(id);
    },
  });

  buffer.enqueue({
    conversationId: 'chat-1',
    phone: '5511999999999',
    message: 'Olá',
  });
  buffer.enqueue({
    conversationId: 'chat-1',
    phone: '5511999999999',
    message: 'boa tarde!',
  });
  buffer.enqueue({
    conversationId: 'chat-1',
    phone: '5511999999999',
    message: 'tudo bem?',
  });

  assert.equal(processed.length, 0);

  await buffer.flush('chat-1');

  assert.equal(processed.length, 1);
  assert.equal(processed[0].message, 'Olá boa tarde! tudo bem?');
  assert.equal(processed[0].hasImage, false);
  assert.deepEqual(clearedTimers, [1, 2, 3]);
});

test('preserva foto e legenda ao consolidar o lote', async () => {
  const processed = [];
  const photo = {
    buffer: Buffer.from('photo'),
    mimetype: 'image/jpeg',
  };

  const buffer = new IncomingMessageBuffer({
    processMessage: async (payload) => processed.push(payload),
    setTimer() {
      return {};
    },
    clearTimer() {},
  });

  buffer.enqueue({
    conversationId: 'chat-photo',
    phone: '5511888888888',
    message: 'segue a foto',
  });
  buffer.enqueue({
    conversationId: 'chat-photo',
    phone: '5511888888888',
    hasImage: true,
    media: photo,
  });

  await buffer.flush('chat-photo');

  assert.equal(processed.length, 1);
  assert.equal(processed[0].message, 'segue a foto');
  assert.equal(processed[0].hasImage, true);
  assert.equal(processed[0].media, photo);
});
