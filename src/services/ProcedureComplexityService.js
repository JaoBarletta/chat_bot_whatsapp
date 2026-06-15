'use strict';

const ProcedureCatalog = require('./ProcedureCatalog');

const Complexity = Object.freeze({
  LOW: 'BAIXA',
  MEDIUM: 'MEDIA',
  HIGH: 'ALTA',
});

class ProcedureComplexityService {
  static classify({ procedure, need }) {
    const text = ProcedureCatalog.normalize([procedure, need].filter(Boolean).join(' '));

    if (
      /\b(implante|cirurgia|cirurgico|siso|enxerto|levantamento de seio|aparelho|ortodontia|protese|dentadura)\b/.test(text)
    ) {
      return Complexity.HIGH;
    }

    if (
      /\b(canal|endodontia|clareamento|restauracao|obturacao|obturar|extracao|extrair)\b/.test(text)
    ) {
      return Complexity.MEDIUM;
    }

    if (
      /\b(consulta|avaliacao|rotina|check-up|checkup|prevencao|limpeza|profilaxia|retorno)\b/.test(text)
    ) {
      return Complexity.LOW;
    }

    return null;
  }

  static requiresAnamnesis(complexity) {
    return complexity === Complexity.HIGH;
  }
}

ProcedureComplexityService.COMPLEXITY = Complexity;

module.exports = ProcedureComplexityService;
