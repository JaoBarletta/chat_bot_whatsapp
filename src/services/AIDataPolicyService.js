'use strict';

class AIDataPolicyService {
  static prepareHumanizationContext({
    patientName,
    patientMessage,
    recentHistory = [],
  } = {}) {
    return {
      patientName: AIDataPolicyService.minimizePatientName(patientName),
      patientMessage: AIDataPolicyService.sanitizeForModel(patientMessage),
      recentHistory: AIDataPolicyService.sanitizeHistory(recentHistory),
    };
  }

  static minimizePatientName(name) {
    const firstName = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)[0];

    return firstName || null;
  }

  static sanitizeHistory(history = []) {
    if (!Array.isArray(history)) return [];

    return history.map((item) => ({
      role: item?.role === 'assistant' ? 'assistant' : 'patient',
      content: AIDataPolicyService.sanitizeForModel(item?.content),
    }));
  }

  static sanitizeForModel(value) {
    return String(value || '')
      .replace(
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        '[EMAIL_REMOVIDO]'
      )
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]')
      .replace(
        /\b(?:cep|endereco|endereço)\s*[:\-]?\s*\d{5}-?\d{3}\b/gi,
        (match) => match.replace(/\d{5}-?\d{3}/, '[DADO_REMOVIDO]')
      )
      .replace(
        /\b(?:data de nascimento|nascimento|nasci|aniversario|aniversário)\s*[:\-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
        (match) =>
          match.replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/, '[DATA_REMOVIDA]')
      )
      .replace(
        /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}/g,
        '[TELEFONE_REMOVIDO]'
      )
      .replace(/\b\d{11,}\b/g, '[NUMERO_REMOVIDO]')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  static getPolicySummary() {
    return {
      policy: process.env.OPENAI_DATA_POLICY || 'lgpd_minimal',
      allowed: [
        'primeiro nome do paciente quando necessario para tom acolhedor',
        'mensagem atual com dados sensiveis removidos',
        'historico recente minimizado quando configurado',
        'texto aprovado pelo fluxo deterministico',
      ],
      blocked: [
        'CPF',
        'e-mail',
        'telefone',
        'data de nascimento',
        'endereco/CEP',
        'numeros longos identificaveis',
        'fotos e arquivos clinicos',
      ],
    };
  }
}

module.exports = AIDataPolicyService;
