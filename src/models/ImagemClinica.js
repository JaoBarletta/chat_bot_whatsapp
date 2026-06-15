const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

// Mapeia para `exames_imagem` do schema
const ImagemClinica = sequelize.define('ExameImagem', {
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
  tipo: {
    type: DataTypes.ENUM('rx_periapical','rx_panoramico','tomografia','telerradiografia','doc_ortodontica','foto_clinica','outro'),
    allowNull: false,
    field: 'tipo',
  },
  descricao: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'descricao',
  },
  url_arquivo: {
    type: DataTypes.STRING(512),
    allowNull: false,
    field: 'url_arquivo',
  },
  data_exame: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'data_exame',
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at',
  },
}, {
  tableName: 'exames_imagem',
  timestamps: false,
});

module.exports = ImagemClinica;
