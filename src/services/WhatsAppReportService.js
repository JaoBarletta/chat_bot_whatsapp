'use strict';
const ValidationLog = require('./ValidationLogService');

class WhatsAppReportService {
  constructor({ groupName = process.env.REPORT_GROUP_NAME || 'Relatorios TCC' } = {}) {
    this.groupName = groupName;
    this.socket = null;
    this.groupId = null;
  }

  registerSocket(socket) {
    this.socket = socket;
    this.groupId = null;
  }

  async send({ report, photo, patient }) {
    return ValidationLog.measure('whatsapp.report', () => this.sendReport({ report, photo, patient }),
      { hasPhoto: Boolean(photo?.buffer) });
  }

  async sendReport({ report, photo, patient }) {
    if (!this.socket) {
      throw new Error('Socket do WhatsApp nao registrado para envio de relatorios.');
    }

    const groupId = await this.resolveGroupId();
    await this.socket.sendMessage(groupId, { text: report });

    if (photo?.buffer) {
      const patientData = patient?.dataValues || patient || {};
      await ValidationLog.measure('whatsapp.photo', () => this.socket.sendMessage(groupId, {
        image: photo.buffer,
        mimetype: photo.mimetype || 'image/jpeg',
        caption: `Foto enviada por ${patientData.nome || 'paciente nao identificado'}.`,
      }));
    }
  }

  async resolveGroupId() {
    if (this.groupId) return this.groupId;

    const groups = await this.socket.groupFetchAllParticipating();
    const expectedName = WhatsAppReportService.normalize(this.groupName);
    const group = Object.values(groups).find(
      ({ subject }) => WhatsAppReportService.normalize(subject) === expectedName
    );

    if (!group) {
      throw new Error(`Grupo "${this.groupName}" nao encontrado no WhatsApp.`);
    }

    this.groupId = group.id;
    return this.groupId;
  }

  static normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}

module.exports = WhatsAppReportService;
