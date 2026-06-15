'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WhatsAppReportService = require('../src/services/WhatsAppReportService');

test('localiza grupo pelo nome e envia relatorio com foto', async () => {
  const sent = [];
  const service = new WhatsAppReportService({
    groupName: 'Relatorios TCC',
  });

  service.registerSocket({
    async groupFetchAllParticipating() {
      return {
        '123@g.us': {
          id: '123@g.us',
          subject: 'Relatorios tcc',
        },
      };
    },
    async sendMessage(to, content) {
      sent.push({ to, content });
    },
  });

  const photoBuffer = Buffer.from('photo');
  await service.send({
    report: 'RELATORIO',
    photo: {
      buffer: photoBuffer,
      mimetype: 'image/jpeg',
    },
    patient: {
      nome: 'Joao Victor',
    },
  });

  assert.equal(sent.length, 2);
  assert.equal(sent[0].to, '123@g.us');
  assert.equal(sent[0].content.text, 'RELATORIO');
  assert.equal(sent[1].content.image, photoBuffer);
  assert.match(sent[1].content.caption, /Joao Victor/);
});

test('informa quando o grupo de relatorios nao existe', async () => {
  const service = new WhatsAppReportService({
    groupName: 'Relatorios TCC',
  });

  service.registerSocket({
    async groupFetchAllParticipating() {
      return {};
    },
    async sendMessage() {},
  });

  await assert.rejects(
    service.send({ report: 'RELATORIO' }),
    /nao encontrado/
  );
});
