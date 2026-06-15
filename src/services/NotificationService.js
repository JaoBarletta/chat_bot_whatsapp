const cron = require('node-cron');
const Agendamento = require('../models/Agendamento');
const Tratamento = require('../models/Tratamento');
const Usuario = require('../models/Usuario');
const { Op } = require('sequelize');
const Historico = require('../models/HistoricoAtendimento');

class NotificationService {
  static start({ sendMessage }) {
    // job to run every day at 00:05 to process reminders for next-day appointments
    cron.schedule('5 0 * * *', async () => {
      try {
        await NotificationService.sendNextDayReminders(sendMessage);
        await NotificationService.sendSixMonthConvocations(sendMessage);
      } catch (err) {
        console.error('NotificationService error:', err.message);
      }
    }, { timezone: 'America/Sao_Paulo' });
  }

  static async sendNextDayReminders(sendMessage) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow.setHours(0,0,0,0));
    const end = new Date(tomorrow.setHours(23,59,59,999));

    const agendamentos = await Agendamento.findAll({
      where: {
        data_hora: { [Op.between]: [start, end] },
        status: { [Op.notIn]: ['cancelada'] },
      },
    });

    for (const a of agendamentos) {
      try {
        const paciente = await Usuario.findByPk(a.paciente_id);
        if (!paciente) continue;
        const existing = await Historico.findOne({
          where: {
            paciente_id: paciente.id,
            consulta_id: a.id,
            tipo: 'lembrete_dia_anterior',
          },
        });

        if (existing) continue; // já enviado

        const to = paciente.telefone;
        const dataStr = a.data_hora ? new Date(a.data_hora).toLocaleDateString() : '';
        const horaStr = a.data_hora ? new Date(a.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const texto = `Lembrete: voce tem uma consulta agendada para ${a.tipo} em ${dataStr} às ${horaStr}. Responda com *confirmar* para confirmar ou *cancelar* para cancelar.`;

        await sendMessage(`${to}`, { text: texto });

        await Historico.create({
          paciente_id: paciente.id,
          modelo_id: null,
          consulta_id: a.id,
          tipo: 'lembrete_dia_anterior',
          conteudo: texto,
          canal: 'whatsapp',
          status: 'enviada',
          enviada_em: new Date(),
        });
      } catch (err) {
        console.error('Erro ao enviar lembrete para agendamento', a.id, err.message);
      }
    }
  }

  static async sendSixMonthConvocations(sendMessage) {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const tratamentos = await Tratamento.findAll({
      where: {
        status: 'concluido',
        realizado_em: { [Op.lte]: sixMonthsAgo },
      },
    });

    for (const t of tratamentos) {
      try {
        const paciente = await Usuario.findByPk(t.paciente_id);
        if (!paciente) continue;
        const to = paciente.telefone;
        const realizadoEm = t.realizado_em ? new Date(t.realizado_em) : null;
        const realizadoStr = realizadoEm ? realizadoEm.toLocaleDateString() : 'data desconhecida';
        const texto = `Convocacao de retorno: seu tratamento ${t.descricao} finalizado em ${realizadoStr}. Agende uma avaliacao de retorno.`;
        await sendMessage(`${to}`, { text: texto });

        // inserir um registro em retornos poderia ser implementado; por ora apenas logamos
      } catch (err) {
        console.error('Erro ao enviar convocacao para tratamento', t.id, err.message);
      }
    }
  }
}

module.exports = NotificationService;
