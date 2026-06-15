'use strict';

const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

const Anamnese = sequelize.define('Anamnese', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    field: 'id',
  },
  paciente_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'paciente_id',
  },
  diabetes: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'diabetes',
  },
  problemas_cardiacos: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'problemas_cardiacos',
  },
  hipertensao: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'hipertensao',
  },
  doencas_sistemicas: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'doencas_sistemicas',
  },
  transfusao_sangue: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'transfusao_sangue',
  },
  transplante: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'transplante',
  },
  tipo_transplante: {
    type: DataTypes.STRING(120),
    allowNull: true,
    field: 'tipo_transplante',
  },
  alergia_medicamentos: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'alergia_medicamentos',
  },
  medicamentos_alergicos: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'medicamentos_alergicos',
  },
  observacoes_anestesico: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'observacoes_anestesico',
  },
  outras_condicoes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'outras_condicoes',
  },
  data_atualizacao: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'data_atualizacao',
  },
}, {
  tableName: 'anamnese',
  timestamps: false,
});

module.exports = Anamnese;
