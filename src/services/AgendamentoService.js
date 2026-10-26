'use strict';

const { Op, Transaction } = require('sequelize');
const Agendamento = require('../models/Agendamento');
const ValidationLog = require('./ValidationLogService');

class AgendamentoService {
  static async syncModel() {
    await Agendamento.sync();
  }

  static async createAppointment(payload, { transaction } = {}) {
    if (!transaction) {
      // The range lock keeps competing bookings from both passing availability.
      return ValidationLog.measure('db.appointment', () => Agendamento.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
        (tx) => AgendamentoService.createAppointment(payload, { transaction: tx })
      ), { reason: 'transaction_committed' });
    }
    const { idUsuario, dataHorario, anamnese } = payload;
    const pacienteId = idUsuario || null;
    const slotAvailable = await AgendamentoService.isSlotAvailable(dataHorario, { transaction });

    if (!slotAvailable) {
      const error = new Error('O horario selecionado nao esta mais disponivel.');
      error.code = 'SLOT_UNAVAILABLE';
      throw error;
    }

    const item = await Agendamento.create({
      paciente_id: pacienteId,
      procedimento_id: null,
      data_hora: dataHorario,
      duracao_min: AgendamentoService.getScheduleConfig().slotMinutes,
      observacoes: anamnese,
      status: 'pendente',
    }, { transaction });

    return item;
  }

  static async findAppointmentsByDate(dateStart, dateEnd) {
    return Agendamento.findAll({
      where: {
        data_hora: { [Op.between]: [dateStart, dateEnd] },
      },
    });
  }

  static async findPendingForDate(dateStart, dateEnd) {
    return Agendamento.findAll({
      where: {
        data_hora: { [Op.between]: [dateStart, dateEnd] },
        status: 'pendente',
      },
    });
  }

  static async getAvailableSlots(date, { transaction } = {}) {
    const selectedDate = AgendamentoService.normalizeDate(date);
    const { openHour, closeHour, slotMinutes } =
      AgendamentoService.getScheduleConfig();
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const appointments = await Agendamento.findAll({
      where: {
        data_hora: { [Op.between]: [dayStart, dayEnd] },
        status: { [Op.in]: ['pendente', 'confirmada'] },
      },
      order: [['data_hora', 'ASC']],
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });

    const occupiedIntervals = appointments.map((appointment) => {
      const data = appointment.dataValues || appointment;
      const start = new Date(data.data_hora);
      const duration = Number(data.duracao_min) || slotMinutes;
      return {
        start,
        end: new Date(start.getTime() + duration * 60 * 1000),
      };
    });

    const opening = new Date(selectedDate);
    opening.setHours(openHour, 0, 0, 0);
    const closing = new Date(selectedDate);
    closing.setHours(closeHour, 0, 0, 0);
    const now = new Date();
    const slots = [];

    for (
      let start = new Date(opening);
      start.getTime() + slotMinutes * 60 * 1000 <= closing.getTime();
      start = new Date(start.getTime() + slotMinutes * 60 * 1000)
    ) {
      const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
      const conflicts = occupiedIntervals.some(
        (occupied) => start < occupied.end && end > occupied.start
      );

      if (!conflicts && start > now) {
        slots.push(AgendamentoService.formatTime(start));
      }
    }

    return slots;
  }

  static async getNextAvailableDates(
    fromDate = new Date(),
    { daysAhead = 30, limit = 5 } = {}
  ) {
    const firstDate = AgendamentoService.normalizeDate(fromDate);
    const availableDates = [];

    for (let offset = 0; offset < daysAhead && availableDates.length < limit; offset += 1) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() + offset);
      const slots = await AgendamentoService.getAvailableSlots(date);

      if (slots.length > 0) {
        availableDates.push({
          date: AgendamentoService.formatDate(date),
          slots,
        });
      }
    }

    return availableDates;
  }

  static async isSlotAvailable(dateTime, options = {}) {
    const selected = new Date(dateTime);
    if (Number.isNaN(selected.getTime())) return false;

    if (selected.getSeconds() || selected.getMilliseconds()) return false;
    const slots = await AgendamentoService.getAvailableSlots(selected, options);
    return slots.includes(AgendamentoService.formatTime(selected));
  }

  static async confirmAppointment(id) {
    const item = await Agendamento.findByPk(id);
    if (!item) return null;
    await item.update({ status: 'confirmada', confirmado_em: new Date() });
    return item;
  }

  static async cancelAppointment(id) {
    const item = await Agendamento.findByPk(id);
    if (!item) return null;
    await item.update({ status: 'cancelada' });
    return item;
  }

  static async markReminderSent(id) {
    const item = await Agendamento.findByPk(id);
    if (!item) return null;
    await item.update({ lembrete_dia: 1 });
    return item;
  }

  static getScheduleConfig() {
    const openHour = AgendamentoService.parseInteger(
      process.env.APPOINTMENT_OPEN_HOUR,
      8
    );
    const closeHour = AgendamentoService.parseInteger(
      process.env.APPOINTMENT_CLOSE_HOUR,
      20
    );
    const slotMinutes = AgendamentoService.parseInteger(
      process.env.APPOINTMENT_SLOT_MINUTES,
      60
    );

    return {
      openHour,
      closeHour: closeHour > openHour ? closeHour : 20,
      slotMinutes: slotMinutes > 0 ? slotMinutes : 60,
    };
  }

  static parseInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static normalizeDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value);
    }

    const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) {
      throw new Error('Data invalida para consulta de disponibilidade.');
    }

    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      throw new Error('Data invalida para consulta de disponibilidade.');
    }

    return date;
  }

  static formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  }

  static formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

module.exports = AgendamentoService;
