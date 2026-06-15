'use strict';

const IntentTypes = require('../constants/IntentTypes');

class PatientReportService {
  static build({ patient, intent, data = {} }) {
    const patientData = patient?.dataValues || patient || {};

    if (intent === IntentTypes.SINTOMA) {
      return PatientReportService.buildTriageReport(patientData, data);
    }

    if (intent === IntentTypes.AGENDAMENTO) {
      return PatientReportService.buildAppointmentReport(patientData, data);
    }

    return PatientReportService.buildGenericReport(patientData, intent, data);
  }

  static buildTriageReport(patient, data) {
    const characteristics = data.characteristics || {};
    const complexity =
      data.complexity || characteristics.complexity || 'Não classificada';
    const need =
      data.need || 'Avaliação odontológica da queixa relatada';
    const appointment = data.appointmentDate || 'Pendente';

    return [
      '*RELATÓRIO ODONTOLÓGICO*',
      `*COMPLEXIDADE: ${String(complexity).toUpperCase()}*`,
      `*NECESSIDADE: ${String(need).toUpperCase()}*`,
      '',
      '*PACIENTE*',
      `Nome: ${patient.nome || 'Não identificado'}`,
      `Telefone: ${patient.telefone || 'Não informado'}`,
      '',
      '*QUADRO CLÍNICO RELATADO*',
      `Queixa principal: ${data.complaint || 'Não informada'}`,
      `Tempo do sintoma: ${characteristics.symptomTime || 'Não informado'}`,
      `Localização: ${characteristics.location || 'Não informada'}`,
      `Características: ${characteristics.description || 'Não informadas'}`,
      `Foto: ${data.photo || data.photoReceived ? 'Enviada' : 'Não enviada'}`,
      '',
      '*AGENDAMENTO*',
      `Data e horário: ${appointment}`,
      `Status: ${data.appointmentDate ? 'Aguardando confirmação da equipe' : 'Pendente de definição'}`,
      '',
      '*OBSERVAÇÃO*',
      'Informações relatadas pelo paciente. Avaliação e conduta são de responsabilidade do dentista.',
    ].join('\n');
  }

  static buildAppointmentReport(patient, data) {
    const anamnesis = data.anamnesis || {};
    const need =
      data.need || data.complaint || data.procedure || 'Agendamento odontológico';
    const complexity = data.complexity || 'Não classificada';

    return [
      '*RELATÓRIO DE AGENDAMENTO*',
      `*COMPLEXIDADE: ${String(complexity).toUpperCase()}*`,
      `*NECESSIDADE: ${String(need).toUpperCase()}*`,
      '',
      '*PACIENTE*',
      `Nome: ${patient.nome || 'Não identificado'}`,
      `Telefone: ${patient.telefone || 'Não informado'}`,
      '',
      '*SOLICITAÇÃO*',
      `Procedimento: ${data.procedure || 'Não informado'}`,
      `Complexidade: ${data.complexity || 'Não classificada'}`,
      `Data e horário: ${data.appointmentDate || 'Pendente'}`,
      'Status: Aguardando confirmação da equipe',
      '',
      '*ANAMNESE ODONTOLÓGICA*',
      ...PatientReportService.buildAnamnesisLines(anamnesis),
    ].join('\n');
  }

  static buildGenericReport(patient, intent, data) {
    return [
      '*RELATÓRIO DE ATENDIMENTO*',
      `*NECESSIDADE: ${String(data.need || data.complaint || intent || 'Não informada').toUpperCase()}*`,
      '',
      '*PACIENTE*',
      `Nome: ${patient.nome || 'Não identificado'}`,
      `Telefone: ${patient.telefone || 'Não informado'}`,
      '',
      '*SOLICITAÇÃO*',
      `Tipo: ${intent || 'Não informado'}`,
      `Mensagem: ${data.complaint || 'Não informada'}`,
      `Data do agendamento: ${data.appointmentDate || 'Pendente'}`,
    ].join('\n');
  }

  static buildAnamnesisLines(anamnesis) {
    const isDentalAnamnesis = [
      'diabetes',
      'hypertension',
      'heartProblems',
      'systemicDiseases',
      'bloodTransfusion',
      'transplant',
      'medicationAllergy',
      'anestheticObservations',
      'otherConditions',
    ].some((field) => Object.prototype.hasOwnProperty.call(anamnesis, field));

    if (!isDentalAnamnesis) {
      const hasLegacyData = Object.values(anamnesis).some(Boolean);
      if (!hasLegacyData) {
        return ['Status: Não realizada'];
      }

      return [
        `Condições de saúde: ${anamnesis.healthConditions || 'Não informadas'}`,
        `Medicamento contínuo: ${anamnesis.continuousMedication || 'Não informado'}`,
        `Alergias: ${anamnesis.allergies || 'Não informadas'}`,
        `Transfusão ou transplante: ${anamnesis.transfusionOrTransplant || 'Não informado'}`,
      ];
    }

    return [
      `Diabetes: ${PatientReportService.yesNo(anamnesis.diabetes)}`,
      `Hipertensão: ${PatientReportService.yesNo(anamnesis.hypertension)}`,
      `Problemas cardíacos: ${PatientReportService.yesNo(anamnesis.heartProblems)}`,
      `Doenças sistêmicas: ${anamnesis.systemicDiseases || 'Não informadas'}`,
      `Transfusão de sangue: ${PatientReportService.yesNo(anamnesis.bloodTransfusion)}`,
      `Transplante: ${PatientReportService.yesNo(anamnesis.transplant)}`,
      `Tipo de transplante: ${anamnesis.transplantType || 'Não informado'}`,
      `Alergia a medicamentos: ${PatientReportService.yesNo(anamnesis.medicationAllergy)}`,
      `Medicamentos alérgicos: ${anamnesis.allergicMedications || 'Não informados'}`,
      `Reação a anestésico: ${anamnesis.anestheticObservations || 'Nenhuma informada'}`,
      `Outras condições: ${anamnesis.otherConditions || 'Nenhuma informada'}`,
    ];
  }

  static yesNo(value) {
    if (value === true || value === 1) return 'Sim';
    if (value === false || value === 0) return 'Não';
    return 'Não informado';
  }
}

module.exports = PatientReportService;
