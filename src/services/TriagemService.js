class TriagemService {
  static normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  static createAnamneseFromAnswers(answers) {
    return JSON.stringify(answers || {});
  }

  static parseAnamnese(anamneseText) {
    try {
      return JSON.parse(anamneseText || '{}');
    } catch (e) {
      return { raw: anamneseText };
    }
  }

  static buildStructuredReport({
    patientName,
    phone,
    complaint,
    symptomTime,
    location,
    characteristics,
    photoReceived,
    complexity,
  }) {
    return [
      'TRIAGEM ODONTOLOGICA',
      `Paciente: ${patientName || 'Nao identificado'}`,
      `Telefone: ${phone || 'Nao informado'}`,
      `Queixa principal: ${complaint || 'Nao informada'}`,
      `Tempo do sintoma: ${symptomTime || 'Nao informado'}`,
      `Localizacao: ${location || 'Nao informada'}`,
      `Caracteristicas: ${characteristics || 'Nao informadas'}`,
      `Foto: ${photoReceived ? 'Enviada' : 'Nao enviada'}`,
      `Complexidade: ${complexity || 'Nao classificada'}`,
    ].join('\n');
  }
}

module.exports = TriagemService;
