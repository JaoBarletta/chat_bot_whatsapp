'use strict';

const OpenAIService = require('./OpenAIService');
const AIResponseGuardService = require('./AIResponseGuardService');
const ProcedureCatalog = require('./ProcedureCatalog');
const IntentTypes = require('../constants/IntentTypes');
const AIDataPolicyService = require('./AIDataPolicyService');
const ValidationLog = require('./ValidationLogService');

class ResponseHumanizerService {
  constructor({ aiService = OpenAIService, mode = null } = {}) {
    this.aiService = aiService;
    this.mode = mode || process.env.OPENAI_HUMANIZATION_MODE || 'always';
  }

  async humanize({
    baseReply,
    intent,
    patientName,
    allowPatientName = true,
    patientMessage,
    recentHistory = [],
  }) {
    const deterministicReply = String(baseReply || '').trim();
    if (!deterministicReply) return deterministicReply;

    // Preserve sensitive values locally instead of asking the model to rewrite them.
    if (AIDataPolicyService.sanitizeForModel(deterministicReply) !== deterministicReply ||
        deterministicReply.length > 1500) {
      await ValidationLog.record('humanizer.decision', { status: 'skipped', reason: 'data_or_size_policy', intent });
      return deterministicReply;
    }

    if (!this.shouldCallAI({ baseReply: deterministicReply, intent })) {
      await ValidationLog.record('humanizer.decision', { status: 'skipped', reason: 'mode_policy', intent, mode: this.mode });
      return deterministicReply;
    }

    try {
      const candidate = await this.aiService.humanizeReply({
        baseReply: deterministicReply,
        intent,
        patientName: allowPatientName ? patientName : null,
        patientMessage,
        recentHistory,
      });

      const accepted = this.isValidCandidate({
        baseReply: deterministicReply,
        candidate,
        patientName,
        conversationInProgress: recentHistory.length > 0,
      });
      const finalReply = accepted ? candidate : deterministicReply;
      await ValidationLog.record('humanizer.decision', { intent,
        status: accepted ? 'accepted' : 'fallback',
        reason: accepted ? 'contract_preserved' : this.rejectionReason(candidate),
        outputChars: String(candidate || '').length });

      this.logDebugDecision({
        baseReply: deterministicReply,
        candidate,
        accepted,
        finalReply,
        reason: accepted
          ? 'A reformulacao preservou o contrato do Flow.'
          : 'A reformulacao alterou ou perdeu parte do contrato do Flow.',
      });

      return finalReply;
    } catch (error) {
      await ValidationLog.record('humanizer.decision', { intent, status: 'fallback', reason: 'api_unavailable', errorCode: ValidationLog.errorCode(error) });
      if (error.code !== 'OPENAI_UNAVAILABLE') {
        console.error('Falha ao humanizar resposta com IA:', error.message);
      }

      this.logDebugDecision({
        baseReply: deterministicReply,
        candidate: null,
        accepted: false,
        finalReply: deterministicReply,
        reason: error.message,
      });
      return deterministicReply;
    }
  }

  shouldCallAI({ baseReply, intent }) {
    const mode = String(this.mode || 'always').toLowerCase();
    if (mode === 'off' || mode === 'false' || mode === 'disabled') {
      return false;
    }

    if (mode === 'always') {
      return true;
    }

    if (
      intent === IntentTypes.SINTOMA ||
      intent === IntentTypes.AGENDAMENTO
    ) {
      return false;
    }

    return !this.isOperationalReply(baseReply);
  }

  rejectionReason(candidate) {
    if (!String(candidate || '').trim()) return 'empty_response';
    if (this.hasUnsafeClinicalClaim(candidate)) return 'clinical_claim';
    if (this.hasDisrespectfulTone(candidate)) return 'disrespectful_tone';
    if (AIResponseGuardService.hasSpeakerLabel(candidate)) return 'speaker_label';
    return 'workflow_contract';
  }

  isOperationalReply(baseReply) {
    const text = ProcedureCatalog.normalize(baseReply);

    return [
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /\b\d{1,2}:\d{2}\b/,
      /\b(horarios disponiveis|datas disponiveis|proximas datas)\b/,
      /\b(so para confirmar|esta tudo certo|a data e o horario estao certos)\b/,
      /\b(registrei sua solicitacao|aguardando confirmacao|a equipe vai conferir)\b/,
      /\b(diabetes|hipertensao|anamnese|transfusao|transplante|anestesia|alergia)\b/,
    ].some((pattern) => pattern.test(text));
  }

  isValidCandidate({
    baseReply,
    candidate,
    patientName,
    conversationInProgress = false,
  }) {
    const approved = String(baseReply || '').trim();
    const generated = String(candidate || '').trim();

    const maximumLength = Math.max(300, approved.length * 2.5);
    if (!generated || generated.length > maximumLength) return false;
    if (AIResponseGuardService.hasSpeakerLabel(generated)) return false;
    if (this.hasDisrespectfulTone(generated)) return false;
    if (this.hasUnsafeClinicalClaim(generated)) return false;
    if (this.introducesProtectedProcedure(approved, generated)) return false;
    if (this.introducesCommitmentClaim(approved, generated)) return false;
    if (this.introducesPatientName(approved, generated, patientName)) return false;
    if (
      this.introducesConversationRestart(
        approved,
        generated,
        conversationInProgress
      )
    ) {
      return false;
    }
    if (!this.preservesWorkflowConcepts(approved, generated)) return false;
    if (!this.preservesProtectedValues(approved, generated)) return false;

    const approvedQuestions = (approved.match(/\?/g) || []).length;
    const generatedQuestions = (generated.match(/\?/g) || []).length;
    return generatedQuestions === approvedQuestions;
  }

  hasUnsafeClinicalClaim(message) {
    const text = ProcedureCatalog.normalize(message);
    return /\b(seu diagnostico|parece ser|provavelmente e|deve ser|precisa fazer|recomendo|aconselho|tratamento indicado|tome [a-z]|use [a-z]+ por \d+ dias|prescrevo|antibiotico indicado|voce tem carie|e uma infeccao|e uma pulpite|ibuprofeno|amoxicilina|dipirona|paracetamol|bochecho|automedicacao)\b/.test(text);
  }

  hasDisrespectfulTone(message) {
    const text = ProcedureCatalog.normalize(message);

    return (
      /\b(?:a?ha){2,}\b|\b(?:he){2,}\b|\bkkk+\b|\brsrs+\b/.test(text) ||
      /\b(frescura|bobagem|drama|exagero|engracado|engracada|hilario|hilária|ridiculo|ridicula)\b/.test(
        text
      ) ||
      /\b(nao e nada|nao e grande coisa|isso passa|aguenta ai|bem real)\b/.test(
        text
      )
    );
  }

  introducesProtectedProcedure(baseReply, candidate) {
    const protectedTerms = ['canal', 'cirurgia', 'extracao', 'implante'];
    const approved = ProcedureCatalog.normalize(baseReply);
    const generated = ProcedureCatalog.normalize(candidate);

    return protectedTerms.some(
      (term) => !approved.includes(term) && generated.includes(term)
    );
  }

  introducesCommitmentClaim(baseReply, candidate) {
    const protectedTerms = [
      'confirmado',
      'confirmada',
      'marcado',
      'marcada',
      'agendado',
      'agendada',
      'garantido',
      'garantida',
    ];
    const approved = ProcedureCatalog.normalize(baseReply);
    const generated = ProcedureCatalog.normalize(candidate);

    return protectedTerms.some(
      (term) => !approved.includes(term) && generated.includes(term)
    );
  }

  introducesPatientName(baseReply, candidate, patientName) {
    const firstName = ProcedureCatalog.normalize(patientName)
      .split(/\s+/)
      .filter(Boolean)[0];

    if (!firstName) return false;

    const approved = ProcedureCatalog.normalize(baseReply);
    const generated = ProcedureCatalog.normalize(candidate);
    return !approved.includes(firstName) && generated.includes(firstName);
  }

  introducesConversationRestart(
    baseReply,
    candidate,
    conversationInProgress
  ) {
    const approved = ProcedureCatalog.normalize(baseReply);
    const generated = ProcedureCatalog.normalize(candidate);
    const startsWithGreeting =
      /^(oi|ola|opa|bom dia|boa tarde|boa noite)\b/.test(generated);

    if (conversationInProgress && startsWithGreeting) {
      return true;
    }

    const genericHelpPhrases = [
      'estou aqui para ajudar',
      'estou aqui para te ajudar',
      'como posso ajudar',
      'como posso te ajudar',
      'precisa de alguma ajuda',
      'conte comigo',
      'estou a disposicao',
    ];

    return genericHelpPhrases.some(
      (phrase) => !approved.includes(phrase) && generated.includes(phrase)
    );
  }

  preservesWorkflowConcepts(baseReply, candidate) {
    const approved = ProcedureCatalog.normalize(baseReply);
    const generated = ProcedureCatalog.normalize(candidate);
    const conceptGroups = [
      ['procedimento', 'atendimento', 'tratamento'],
      ['agendar', 'agendamento', 'marcar'],
      ['data', 'dia'],
      ['horario', 'hora'],
      ['foto', 'imagem'],
      ['dor', 'incomodo', 'sintoma'],
      ['quanto tempo', 'desde quando', 'ha quanto tempo'],
      ['dente', 'regiao', 'localizacao', 'local'],
      ['alergia', 'alergico'],
      ['anestesia', 'anestesico'],
      ['diabetes'],
      ['hipertensao', 'pressao alta'],
      ['transfusao'],
      ['transplante'],
    ];

    return conceptGroups.every((terms) => {
      const required = terms.some((term) => approved.includes(term));
      return !required || terms.some((term) => generated.includes(term));
    });
  }

  preservesProtectedValues(baseReply, candidate) {
    const approved = ProcedureCatalog.normalize(baseReply);
    const generated = ProcedureCatalog.normalize(candidate);
    const approvedNumbers = approved.match(/\b\d+(?:[/-]\d+)*\b/g) || [];
    const generatedNumbers = generated.match(/\b\d+(?:[/-]\d+)*\b/g) || [];

    if (!this.haveSameValues(approvedNumbers, generatedNumbers)) {
      return false;
    }

    const approvedProcedures = ProcedureCatalog.extractAll(approved);
    const generatedProcedures = ProcedureCatalog.extractAll(generated);
    return this.haveSameValues(approvedProcedures, generatedProcedures);
  }

  haveSameValues(left, right) {
    const leftValues = [...new Set(left)].sort();
    const rightValues = [...new Set(right)].sort();
    return JSON.stringify(leftValues) === JSON.stringify(rightValues);
  }

  logDebugDecision(payload) {
    if (typeof this.aiService.logDebugDecision === 'function') {
      this.aiService.logDebugDecision(payload);
      return;
    }

  }
}

module.exports = ResponseHumanizerService;
