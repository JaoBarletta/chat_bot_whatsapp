const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

// Mapeia para a tabela `consultas` do schema
const Agendamento = sequelize.define('Consulta', {
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
  procedimento_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'procedimento_id',
  },
  data_hora: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'data_hora',
  },
  duracao_min: {
    type: DataTypes.SMALLINT.UNSIGNED,
    allowNull: true,
    defaultValue: 60,
    field: 'duracao_min',
  },
  status: {
    type: DataTypes.ENUM('pendente','confirmada','cancelada','realizada','remarcada'),
    allowNull: false,
    defaultValue: 'pendente',
    field: 'status',
  },
  tipo: {
    type: DataTypes.ENUM('consulta','retorno','avaliacao','emergencia'),
    allowNull: false,
    defaultValue: 'consulta',
    field: 'tipo',
  },
  observacoes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'observacoes',
  },
  lembrete_dia: {
    type: DataTypes.TINYINT,
    allowNull: true,
    defaultValue: 0,
    field: 'lembrete_dia',
  },
  confirmado_em: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'confirmado_em',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at',
  },
}, {
  tableName: 'consultas',
  timestamps: false,
});

module.exports = Agendamento;
