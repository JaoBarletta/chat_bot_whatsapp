const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

// Mapeia para tabela `tratamentos` do schema
const Tratamento = sequelize.define('Tratamento', {
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
  consulta_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'consulta_id',
  },
  procedimento_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'procedimento_id',
  },
  numero_dente: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: true,
    field: 'numero_dente',
  },
  face: {
    type: DataTypes.ENUM('V','L','M','D','O','C','R','todos'),
    allowNull: true,
    defaultValue: 'todos',
    field: 'face',
  },
  descricao: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'descricao',
  },
  status: {
    type: DataTypes.ENUM('planejado','em_andamento','concluido','cancelado'),
    allowNull: false,
    defaultValue: 'planejado',
    field: 'status',
  },
  realizado_em: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'realizado_em',
  },
  dentista_externo: {
    type: DataTypes.STRING(120),
    allowNull: true,
    field: 'dentista_externo',
  },
  observacoes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'observacoes',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'tratamentos',
  timestamps: false,
});

module.exports = Tratamento;
