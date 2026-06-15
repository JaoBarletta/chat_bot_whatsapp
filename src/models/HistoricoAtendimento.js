const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

// Agora mapeia para `mensagens_enviadas` do schema
const HistoricoAtendimento = sequelize.define('MensagemEnviada', {
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
  modelo_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'modelo_id',
  },
  consulta_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'consulta_id',
  },
  tipo: {
    type: DataTypes.ENUM('confirmacao','lembrete_dia_anterior','lembrete_dia','convocacao_retorno','orcamento','manual','segmentada','chatbot'),
    allowNull: false,
    field: 'tipo',
  },
  conteudo: {
    type: DataTypes.TEXT,
    allowNull: false,
    field: 'conteudo',
  },
  canal: {
    type: DataTypes.ENUM('whatsapp'),
    allowNull: false,
    defaultValue: 'whatsapp',
    field: 'canal',
  },
  status: {
    type: DataTypes.ENUM('enviada','entregue','lida','falha'),
    allowNull: false,
    defaultValue: 'enviada',
    field: 'status',
  },
  enviada_em: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'enviada_em',
  },
}, {
  tableName: 'mensagens_enviadas',
  timestamps: false,
});

module.exports = HistoricoAtendimento;
