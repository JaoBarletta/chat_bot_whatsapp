'use strict';

const Anamnese = require('../models/Anamnese');

class AnamneseService {
  static async syncModel() {
    await Anamnese.sync();
  }

  static async saveForPatient({ patientId, anamnesis }) {
    if (!patientId) {
      throw new Error('Paciente obrigatorio para salvar a anamnese.');
    }

    const payload = {
      paciente_id: patientId,
      diabetes: Boolean(anamnesis.diabetes),
      problemas_cardiacos: Boolean(anamnesis.heartProblems),
      hipertensao: Boolean(anamnesis.hypertension),
      doencas_sistemicas: anamnesis.systemicDiseases || null,
      transfusao_sangue: Boolean(anamnesis.bloodTransfusion),
      transplante: Boolean(anamnesis.transplant),
      tipo_transplante: anamnesis.transplantType || null,
      alergia_medicamentos: Boolean(anamnesis.medicationAllergy),
      medicamentos_alergicos: anamnesis.allergicMedications || null,
      observacoes_anestesico: anamnesis.anestheticObservations || null,
      outras_condicoes: anamnesis.otherConditions || null,
      data_atualizacao: new Date(),
    };

    const existing = await Anamnese.findOne({
      where: { paciente_id: patientId },
      order: [['id', 'DESC']],
    });

    if (existing) {
      await existing.update(payload);
      return existing;
    }

    return Anamnese.create(payload);
  }

  static async findLatestByPatient(patientId) {
    return Anamnese.findOne({
      where: { paciente_id: patientId },
      order: [['id', 'DESC']],
    });
  }
}

module.exports = AnamneseService;
