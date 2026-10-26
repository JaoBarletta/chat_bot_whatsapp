'use strict';

class AIResponseGuardService {
  static sanitizeReply(text) {
    let value = String(text || '')
      .replace(/["""]/g, '')
      .replace(/^\s*```(?:\w+)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .replace(/^\s*[`']+|[`']+\s*$/g, '')
      .replace(/\*\*/g, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/gm, '')
      .trim();

    value = AIResponseGuardService.removeGenerationLabels(value);
    value = AIResponseGuardService.removeSpeakerLabels(value);

    return value
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s+$/gm, '')
      .trim();
  }

  static removeGenerationLabels(text) {
    let value = String(text || '').trim();
    const labelPattern =
      /^\s*(?:(?:mensagem|resposta|texto)\s+(?:reformulad[ao]|humanizad[ao])|versao\s+reformulada|saida|output)\s*[:\-]\s*/i;

    while (labelPattern.test(value)) {
      value = value.replace(labelPattern, '').trim();
    }

    return value;
  }

  static removeSpeakerLabels(text) {
    const value = String(text || '').trim();
    if (!value) return value;

    const inlineAssistant = value.match(
      /\b(?:atendente|assistente|bot|recepcionista)\s*[:\-]\s*([\s\S]*)$/i
    );
    const hasPatientBeforeAssistant =
      inlineAssistant &&
      /(?:^|\n|\b)(?:paciente|usuario|usuaria|cliente)\s*[:\-]/i.test(
        value.slice(0, inlineAssistant.index)
      );

    if (hasPatientBeforeAssistant) {
      return AIResponseGuardService.removeGenerationLabels(
        inlineAssistant[1]
      ).trim();
    }

    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    let foundSpeakerLine = false;
    const assistantLines = [];
    const unlabeledLines = [];

    for (const line of lines) {
      const assistantMatch = line.match(
        /^(?:atendente|assistente|bot|recepcionista)\s*[:\-]\s*(.*)$/i
      );

      if (assistantMatch) {
        foundSpeakerLine = true;
        if (assistantMatch[1].trim()) {
          assistantLines.push(assistantMatch[1].trim());
        }
        continue;
      }

      if (
        /^(?:paciente|usuario|usuaria|cliente)\s*[:\-]\s*/i.test(line)
      ) {
        foundSpeakerLine = true;
        continue;
      }

      unlabeledLines.push(line);
    }

    if (foundSpeakerLine && assistantLines.length > 0) {
      return assistantLines.join('\n');
    }

    if (foundSpeakerLine) {
      return unlabeledLines.join('\n');
    }

    return value.replace(
      /^(?:atendente|assistente|bot|recepcionista)\s*[:\-]\s*/i,
      ''
    );
  }

  static hasSpeakerLabel(text) {
    return /(?:^|\n)\s*(?:paciente|usuario|usuaria|cliente|atendente|assistente|bot|recepcionista)\s*[:\-]/i.test(
      String(text || '')
    );
  }
}

module.exports = AIResponseGuardService;
