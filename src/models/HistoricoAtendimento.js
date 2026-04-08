const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

const HistoricoAtendimento = sequelize.define(
  'HistoricoAtendimento',
  {
    id_historico: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'id_historico',
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'id_usuario',
    },
    telefone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: 'telefone',
    },
    mensagem_recebida: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'mensagem_recebida',
    },
    tipo_solicitacao: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: 'tipo_solicitacao',
    },
    resposta_enviada: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'resposta_enviada',
    },
    evento_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'evento_inicio',
    },
    evento_fim: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'evento_fim',
    },
  },
  {
    tableName: 'historico_atendimento',
    timestamps: false,
  }
);

module.exports = HistoricoAtendimento;
