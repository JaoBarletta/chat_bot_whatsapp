const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

// Ajustado para usar a tabela `pacientes` do schema fornecido
const Usuario = sequelize.define('Paciente', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
    field: 'id',
  },
  nome: {
    type: DataTypes.STRING(120),
    allowNull: false,
    field: 'nome',
  },
  telefone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    field: 'telefone',
  },
  data_nascimento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'data_nascimento',
  },
  cpf: {
    type: DataTypes.STRING(14),
    allowNull: true,
    field: 'cpf',
  },
  email: {
    type: DataTypes.STRING(120),
    allowNull: true,
    field: 'email',
  },
  sexo: {
    type: DataTypes.ENUM('M','F','O'),
    allowNull: true,
    field: 'sexo',
  },
  endereco: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'endereco',
  },
  perfil_cor: {
    type: DataTypes.ENUM('cirurgia','limpeza','restauracao','estetica','ortodontia','implante','outro'),
    allowNull: true,
    field: 'perfil_cor',
  },
  ativo: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    field: 'ativo',
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
  tableName: 'pacientes',
  timestamps: false,
});

module.exports = Usuario;
