const HistoricoAtendimento = require('../models/HistoricoAtendimento');
const AgendamentoService = require('./AgendamentoService');
const TriagemService = require('./TriagemService');

class AtendimentoService {
  static async syncModel() {
    await HistoricoAtendimento.sync();
  }


  static classifyRequest(message) {
    const text = (message || '').toLowerCase();

    if (/humano|atendente|pessoa|suporte/.test(text)) {
      return 'humano';
    }

    if (/orcamento|orçamento|valor|preco|preço|parcel|pagamento|juros|cartao|cartão|boleto|pix/.test(text)) {
      return 'financeiro';
    }
    if (/historico|histórico|prontuario|prontuário|anamnese|exame/.test(text)) {
        return 'historico';
    }
    if (/confirmar|confirmacao|confirmação|remarcar|cancelar|2\b|1\b/.test(text)) {
      return 'confirmacao';
    }

    if (/dor|incha[cç]o|sangramento|quebrei|caiu|trincou|cárie|carie|sensibilidade|abscesso|machucou|ferida/.test(text)) {
      return 'sintoma';
    }

    if (/agendar|agendamento|consulta|marcar|horario/.test(text)) {
      return 'agendamento';
    }

    if (/duvida|dúvida|como|qual|onde|quando|funciona/.test(text)) {
      return 'duvida';
    }

    return 'outro';
  }

  
  static async classifyRequestSmart(message) {
    const FlowRouter = require('./FlowRouter');
    const intent = await new FlowRouter().route(message);
    return intent.toLowerCase();
  }



  static isSchedulingMessage(message) {
  const text = (message || '').toLowerCase();

  if (/dor|incha[cç]o|sangramento|quebrei|caiu|trincou|cárie|carie|sensibilidade|abscesso|machucou|ferida|dente quebrado|dente mole/.test(text)) {
    return false;
  }

  return /agendar|agendamento|consulta|marcar|horario|horário|limpeza|canal|implante|cirurg|clareamento|extrac|extra[cç]a|restaura/.test(text);
}

  static detectProcedureType(message) {
    const text = (message || '').toLowerCase();

    if (/implante|cirurg|siso|levantamento de seio|maxilar|ortodont|aparelho|protese|prótese|documentacao ortodontica|documentação ortodontica/.test(text)) {
      return 'complexo';
    }

    if (/clareamento|canal|extrac[aç]o simples|extracao simples|restaur|selante|retorno/.test(text)) {
      return 'moderado';
    }

    if (/consulta|avaliacao|avaliação|limpeza|profilaxia/.test(text)) {
      return 'simples';
    }

    return null;
  }
  static extractProcedure(message) {
    const text = (message || '').toLowerCase();

    const procedures = [
      'limpeza de dentes',
      'limpeza',
      'profilaxia',
      'consulta',
      'avaliação',
      'avaliacao',
      'canal',
      'clareamento',
      'implante',
      'cirurgia',
      'extração',
      'extracao',
      'restauração',
      'restauracao',
      'aparelho',
      'prótese',
      'protese',
      'retorno'
    ];

    return procedures.find(p => text.includes(p)) || null;
  }

static isAvailabilityQuestion(message) {
  const text = (message || '').toLowerCase();

  return /quais dias|tem disponivel|tem disponível|disponibilidade|horarios disponiveis|horários disponíveis|quando tem|agenda/.test(text);
}

static isValidDateAnswer(message) {
  const text = (message || '').trim().toLowerCase();

  if (/^(hoje|amanha|amanhã|qualquer dia|o mais rapido possivel|o mais rápido possível)$/.test(text)) {
    return true;
  }

  let date = null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const [dia, mes, ano] = text.split('/').map(Number);
    date = new Date(ano, mes - 1, dia);
  }

  if (/^\d{2}\/\d{2}$/.test(text)) {
    const [dia, mes] = text.split('/').map(Number);
    const anoAtual = new Date().getFullYear();
    date = new Date(anoAtual, mes - 1, dia);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    date = new Date(text);
  }

  if (!date || Number.isNaN(date.getTime())) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  date.setHours(0, 0, 0, 0);

  return date >= hoje;
}

  static isShortAffirmative(message) {
    const text = (message || '').trim().toLowerCase();
    return /^(sim|s|ok|pode ser|confirmo|confirmar|1)$/.test(text);
  }

  static isNegativeOrReschedule(message) {
    const text = (message || '').trim().toLowerCase();
    return /^(nao|não|2|remarcar|cancelar|cancelamento|trocar)$/.test(text);
  }

static normalizeDateInput(message) {
  const text = (message || '').trim().toLowerCase();

  if (text === 'hoje') {
    const hoje = new Date();
    return hoje.toLocaleDateString('pt-BR');
  }

  if (text === 'amanha' || text === 'amanhã') {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    return amanha.toLocaleDateString('pt-BR');
  }

  if (/^\d{2}\/\d{2}$/.test(text)) {
    const anoAtual = new Date().getFullYear();
    return `${text}/${anoAtual}`;
  }

  return message.trim();
}

  static createSchedulingState() {
    return {
      type: 'agendamento',
      step: 'waiting_specialty',
      specialty: null,
      procedureComplexity: null,
      anamnese: {
        condicoes_gerais: null,
        medicamentos_uso_continuo: null,
        alergias_medicamentos: null,
        transfusao_ou_transplante: null,
      },
      date: null,
      period: null,
      reason: null,
      confirmacaoPendende: false,
      greeted: false,
    };
  }

  static createSymptomState() {
    return {
      type: 'sintoma',
      step: 'waiting_time',
      queixa: null,
      tempoSintoma: null,
      localizacao: null,
      caracteristica: null,
      fotoRecebida: false,
      urgente: false,
    };
  }

  static getSchedulingQuestion(state) {
    if (state.step === 'waiting_specialty') {
      return 'Perfeito. Qual procedimento ou tratamento voce deseja agendar?';
    }

    if (state.step === 'waiting_anamnese_condicoes') {
      return 'Para esse procedimento, preciso de algumas informacoes rapidas antes de confirmar o agendamento. Voce tem diabetes, problema cardiaco, hipertensao ou outra condicao de saude relevante?';
    }

    if (state.step === 'waiting_anamnese_medicamentos') {
      return 'Voce faz uso de algum medicamento continuo ou tem alergia a algum medicamento ou anestesico?';
    }

    if (state.step === 'waiting_anamnese_transfusao') {
      return 'Ja realizou transfusao de sangue ou transplante de orgao? Se sim, informe qual.';
    }

    if (state.step === 'waiting_date') {
      return 'Anotado! Essas informacoes serao avaliadas pela equipe antes da consulta. Qual data voce prefere?';
    }

    if (state.step === 'waiting_period') {
      return 'Prefere manha ou tarde?';
    }

    if (state.step === 'waiting_reason') {
      return 'Ha algum motivo especifico ou queixa principal para a consulta?';
    }

    if (state.step === 'waiting_confirmation') {
      return `Entendido! Vou registrar: ${state.specialty || 'o procedimento'} no dia ${state.date || 'a definir'}, periodo ${state.period || 'a definir'}. Confirma?`;
    }

    return 'Certo. Vamos seguir com seu agendamento.';
  }

  static normalizeSchedulingPeriod(message) {
    const text = (message || '').toLowerCase();

    if (/manha|manhã/.test(text)) return 'manha';
    if (/tarde/.test(text)) return 'tarde';
    if (/noite/.test(text)) return 'noite';

    return null;
  }

  static async finalizeScheduling({ pacienteNome, contextoCadastro, state }) {
    const nome = pacienteNome || 'paciente';
    const especialidade = state.specialty || 'especialidade nao informada';
    const data = state.date || 'data nao informada';
    const periodo = state.period || 'periodo nao informado';
    const motivo = state.reason || 'motivo nao informado';
    const telefone = contextoCadastro?.telefone || 'nao informado';

    // tenta parsear data informada para um Date
    let dataHorario = null;
    try {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(state.date || '')) {
        const [dia, mes, ano] = (state.date || '').split('/');
        const hour = periodo === 'manha' ? 9 : periodo === 'tarde' ? 15 : periodo === 'noite' ? 19 : 10;
        dataHorario = new Date(`${ano}-${mes}-${dia}T${String(hour).padStart(2,'0')}:00:00`);
      } else {
        const maybe = new Date(state.date);
        if (!Number.isNaN(maybe.getTime())) dataHorario = maybe;
      }
    } catch (e) {
      dataHorario = null;
    }

    const anamnese = TriagemService.createAnamneseFromAnswers({
      especialidade,
      condicoes_gerais: state.anamnese?.condicoes_gerais || null,
      medicamentos_uso_continuo: state.anamnese?.medicamentos_uso_continuo || null,
      alergias_medicamentos: state.anamnese?.alergias_medicamentos || null,
      transfusao_ou_transplante: state.anamnese?.transfusao_ou_transplante || null,
      reason: motivo,
    });

    try {
      await AgendamentoService.createAppointment({
        idUsuario: contextoCadastro?.id,
        telefone: contextoCadastro?.telefone,
        dataHorario: dataHorario || new Date(),
        tipoProcedimento: especialidade,
        anamnese,
      });
    } catch (err) {
      // não interrompe o fluxo, apenas loga
      console.error('Erro ao criar agendamento:', err.message);
    }

    return [
      `Entendido, ${nome}. Vou registrar: ${especialidade} no dia ${data}, periodo ${periodo}.`,
      motivo ? `Motivo informado: ${motivo}.` : '',
      `Assim que a equipe confirmar, voce recebera a resposta aqui no WhatsApp pelo telefone ${telefone}.`,
    ].join(' ');
  }

  static buildFallbackReply({ tipoSolicitacao, pacienteNome }) {
    if (tipoSolicitacao === 'duvida') {
      return `Posso te ajudar com informacoes sobre consultas, horarios e preparos.`;
    }

    if (tipoSolicitacao === 'agendamento') {
      return 'Vamos seguir com o agendamento. Informe a especialidade, a data desejada e o periodo ideal.';
    }

    if (tipoSolicitacao === 'humano') {
      return 'Certo! Vou encaminhar seu atendimento para um humano agora.';
    }

    return 'Entendi. Vou analisar sua solicitacao e te responder da melhor forma possivel.';
  }

  static async buildReply({ tipoSolicitacao, pacienteNome, mensagem, contextoCadastro }) {
    return AtendimentoService.buildFallbackReply({
      tipoSolicitacao,
      pacienteNome,
      mensagem,
      contextoCadastro,
    });
  }

  static async handleSchedulingStep({ state, message, pacienteNome, contextoCadastro }) {
    const normalizedMessage = (message || '').trim();

    if (state.step === 'waiting_specialty') {
      state.specialty = normalizedMessage;
      state.procedureComplexity = AtendimentoService.detectProcedureType(normalizedMessage);

      if (state.procedureComplexity === 'complexo') {
        state.step = 'waiting_anamnese_condicoes';
      } else if (state.procedureComplexity === 'moderado') {
        state.step = 'waiting_date';
      } else if (state.procedureComplexity === 'simples') {
        state.step = 'waiting_date';
      } else {
        state.step = 'waiting_anamnese_condicoes';
      }

      return {
        state,
        reply: AtendimentoService.getSchedulingQuestion(state),
        finished: false,
      };
    }

    if (state.step === 'waiting_anamnese_condicoes') {
      state.anamnese.condicoes_gerais = normalizedMessage;
      state.step = 'waiting_anamnese_medicamentos';
      return {
        state,
        reply: AtendimentoService.getSchedulingQuestion(state),
        finished: false,
      };
    }

    if (state.step === 'waiting_anamnese_medicamentos') {
      state.anamnese.medicamentos_uso_continuo = normalizedMessage;
      state.step = 'waiting_anamnese_transfusao';
      return {
        state,
        reply: AtendimentoService.getSchedulingQuestion(state),
        finished: false,
      };
    }

    if (state.step === 'waiting_anamnese_transfusao') {
      state.anamnese.transfusao_ou_transplante = normalizedMessage;
      state.step = 'waiting_date';
      return {
        state,
        reply: AtendimentoService.getSchedulingQuestion(state),
        finished: false,
      };
    }

if (state.step === 'waiting_date') {
  if (AtendimentoService.isAvailabilityQuestion(normalizedMessage)) {
    return {
      state,
      reply: 'No momento eu nao consigo consultar a agenda em tempo real. Me informe uma data de preferencia e a equipe verificara a disponibilidade.',
      finished: false,
    };
  }

  if (!AtendimentoService.isValidDateAnswer(normalizedMessage)) {
    return {
      state,
      reply: 'Informe uma data valida para o agendamento, por exemplo 20/06/2026, amanha ou qualquer dia.',
      finished: false,
    };
  }

  state.date = AtendimentoService.normalizeDateInput(normalizedMessage);

  if (/qualquer dia|o mais rapido possivel|o mais rápido possível/.test(normalizedMessage.toLowerCase())) {
    state.period = 'a confirmar pela equipe';
    state.step = 'waiting_confirmation';

    return {
      state,
      reply: AtendimentoService.getSchedulingQuestion(state),
      finished: false,
    };
  }

  state.step = 'waiting_period';

  return {
    state,
    reply: AtendimentoService.getSchedulingQuestion(state),
    finished: false,
  };
}

    if (state.step === 'waiting_period') {
      const period = AtendimentoService.normalizeSchedulingPeriod(normalizedMessage) || normalizedMessage;
      state.period = period;

      if (state.procedureComplexity === 'complexo') {
        state.step = 'waiting_reason';
      } else {
        state.step = 'waiting_confirmation';
      }

      return {
        state,
        reply: AtendimentoService.getSchedulingQuestion(state),
        finished: false,
      };
    }

    if (state.step === 'waiting_reason') {
      state.reason = normalizedMessage;
      state.step = 'waiting_confirmation';

      return {
        state,
        reply: AtendimentoService.getSchedulingQuestion(state),
        finished: false,
      };
    }

    if (state.step === 'waiting_confirmation') {
      if (AtendimentoService.isShortAffirmative(normalizedMessage)) {
        state.step = 'finished';

        const reply = await AtendimentoService.finalizeScheduling({
          pacienteNome,
          contextoCadastro,
          state,
        });

        return {
          state,
          reply: `${reply} Consulta registrada! Voce recebera uma confirmacao aqui pelo WhatsApp um dia antes. Qualquer duvida e so chamar.`,
          finished: true,
        };
      }

      if (AtendimentoService.isNegativeOrReschedule(normalizedMessage)) {
        state.step = 'waiting_date';
        return {
          state,
          reply: 'Tudo bem. Qual nova data voce prefere?',
          finished: false,
        };
      }

      return {
        state,
        reply: 'Confirma o agendamento com sim, 1 ou confirmar? Se preferir, posso remarcar.',
        finished: false,
      };
    }

    return {
      state,
      reply: 'Certo. Vamos seguir com seu agendamento.',
      finished: false,
    };
  }


  static createSymptomAnswer(state, message) {
  const normalized = (message || '').trim();

  if (!state.queixa) {
    state.queixa = normalized;
    state.step = 'waiting_time';
    return 'Entendido, vou coletar algumas informacoes para encaminhar ao dentista. Ha quanto tempo voce esta sentindo isso?';
  }

  if (!state.tempoSintoma) {
    state.tempoSintoma = normalized;
    state.step = 'waiting_localization';
    return 'Consegue identificar em qual dente ou regiao da boca esta o problema?';
  }

  if (!state.localizacao) {
    state.localizacao = normalized;
    state.step = 'waiting_characteristic';
    return 'A dor ou incomodo e constante ou aparece em momentos especificos, como ao comer ou tomar algo gelado?';
  }

  if (!state.caracteristica) {
    state.caracteristica = normalized;
    state.step = 'waiting_photo';
    return 'Voce consegue enviar uma foto da regiao que esta incomodando? Se nao conseguir, pode responder nao.';
  }

  if (state.step === 'waiting_photo') {
    state.fotoRecebida = /sim|enviei|foto|imagem/.test(normalized.toLowerCase());

    const textoCompleto = [
      state.queixa,
      state.tempoSintoma,
      state.localizacao,
      state.caracteristica,
      normalized,
    ].join(' ').toLowerCase();

    state.urgente = /muito forte|insuportavel|febre|rosto inchado|incha[cç]o grande|sangramento intenso|trauma|batida/.test(textoCompleto);

    state.step = 'finished';

    return state.urgente
      ? 'Anotei tudo. Como voce relatou sinais importantes, vou encaminhar seu caso com prioridade para o dentista avaliar. A equipe confirmara o melhor atendimento antes de qualquer agendamento.'
      : 'Anotei tudo. Vou encaminhar seu caso para o dentista avaliar. Ele confirmara o melhor tipo de atendimento e depois seguimos com o agendamento.';
  }

  return 'Seu caso ja foi encaminhado para avaliacao da equipe.';
}

static async handleSymptomStep({ state, message }) {
  return {
    state,
    reply: AtendimentoService.createSymptomAnswer(state, message),
    finished: state.step === 'finished',
  };
}
  static async handleReturnOrConfirmationStep({ state, message }) {
    const normalized = (message || '').trim().toLowerCase();

    if (AtendimentoService.isShortAffirmative(normalized)) {
      return {
        state,
        reply: 'Perfeito! Vou seguir com o agendamento de retorno/confirmacao.',
        finished: false,
      };
    }

    if (AtendimentoService.isNegativeOrReschedule(normalized)) {
      return {
        state,
        reply: 'Tudo bem. Me diga a nova data e o periodo que prefere.',
        finished: false,
      };
    }

    return {
      state,
      reply: 'Voce pode confirmar com sim/1 ou remarcar com 2/remarcar.',
      finished: false,
    };
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
    try {
      await HistoricoAtendimento.create({
        paciente_id: idUsuario || null,
        modelo_id: null,
        consulta_id: null,
        tipo: 'chatbot',
        conteudo: respostaEnviada || mensagemRecebida || '',
        canal: 'whatsapp',
        status: 'enviada',
        enviada_em: eventoFim || new Date(),
      });
    } catch (err) {
      console.error('Erro ao salvar historico/mensagem:', err.message);
    }
  }
}

module.exports = AtendimentoService;
