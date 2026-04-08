const HistoricoAtendimento = require('../models/HistoricoAtendimento');

class AtendimentoService {
  static async syncModel() {
    await HistoricoAtendimento.sync();
  }

  static classifyRequest(message) {
    const text = (message || '').toLowerCase();

    if (/humano|atendente|pessoa|suporte/.test(text)) {
      return 'humano';
    }

    if (/agendar|agendamento|consulta|marcar|horario/.test(text)) {
      return 'agendamento';
    }

    if (/duvida|dúvida|como|qual|onde|quando|funciona/.test(text)) {
      return 'duvida';
    }

    return 'outro';
  }

  static buildReply({ tipoSolicitacao, pacienteNome }) {
    if (tipoSolicitacao === 'duvida') {
      return `Oi ${pacienteNome || ''}! Posso te ajudar com informacoes sobre consultas, horarios e preparos.`.trim();
    }

    if (tipoSolicitacao === 'agendamento') {
      return 'Para agendamento, informe: especialidade, dia desejado e periodo (manha/tarde/noite).';
    }

    if (tipoSolicitacao === 'humano') {
      return 'Certo! Vou encaminhar seu atendimento para um humano agora.';
    }

    return 'Entendi. Vou analisar sua solicitacao e te responder da melhor forma possivel.';
  }

  static async saveHistory({
    idUsuario,
    telefone,
    mensagemRecebida,
    tipoSolicitacao,
    respostaEnviada,
    eventoInicio,
    eventoFim,
  }) {
    await HistoricoAtendimento.create({
      id_usuario: idUsuario || null,
      telefone,
      mensagem_recebida: mensagemRecebida,
      tipo_solicitacao: tipoSolicitacao,
      resposta_enviada: respostaEnviada,
      evento_inicio: eventoInicio,
      evento_fim: eventoFim,
    });
  }
}

module.exports = AtendimentoService;
