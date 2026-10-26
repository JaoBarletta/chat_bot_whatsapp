'use strict';

const ApproximateTextService = require('./ApproximateTextService');

const PROCEDURES = Object.freeze([
  { name: 'Limpeza', terms: ['limpeza', 'profilaxia'] },
  { name: 'Consulta', terms: ['consulta'] },
  { name: 'Avaliacao', terms: ['avaliacao'] },
  { name: 'Retorno', terms: ['retorno'] },
  { name: 'Clareamento', terms: ['clareamento'] },
  { name: 'Tratamento de canal', terms: ['canal', 'endodontia'] },
  { name: 'Implante', terms: ['implante'] },
  { name: 'Cirurgia', terms: ['cirurgia'] },
  { name: 'Extracao', terms: ['extracao', 'extrair', 'arrancar dente'] },
  { name: 'Restauracao', terms: ['restauracao', 'obturar', 'obturacao'] },
  { name: 'Aparelho ortodontico', terms: ['aparelho', 'ortodontia'] },
  { name: 'Protese', terms: ['protese', 'dentadura'] },
]);

class ProcedureCatalog {
  static normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  static extract(message) {
    return ProcedureCatalog.extractAll(message)[0] || null;
  }

  static extractAll(message) {
    const text = ProcedureCatalog.normalize(message);
    return PROCEDURES
      .filter(({ terms }) =>
        terms.some((term) => ProcedureCatalog.matchesTerm(text, term))
      )
      .map(({ name }) => name);
  }

  static containsKnownProcedure(message) {
    return Boolean(ProcedureCatalog.extract(message));
  }

  static canonicalize(value) {
    const rawValue = String(value || '').trim();
    const text = ProcedureCatalog.normalize(rawValue);
    if (!text) return null;

    const procedure = PROCEDURES.find(({ name, terms }) => {
      if (ProcedureCatalog.normalize(name) === text) return true;
      return terms.some((term) => ProcedureCatalog.matchesTerm(text, term));
    });

    return procedure?.name || rawValue;
  }

  static matchesTerm(text, term) {
    if (text.includes(term)) return true;
    if (term.includes(' ')) return false;

    return ApproximateTextService.containsAnyWord(text, [term]);
  }
}

module.exports = ProcedureCatalog;
