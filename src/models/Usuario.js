const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

const Usuario = sequelize.define('Usuario', {
  id_usuario: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_usuario',
  },
  nome: {
    type: DataTypes.STRING(150),
    allowNull: false,
    field: 'nome',
    comment: 'Nome do usuário',
  },
  data_nascimento: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'data_nascimento',
    comment: 'Data de nascimento do paciente',
  },
  cpf: {
    type: DataTypes.STRING(14),
    allowNull: false,
    field: 'cpf',
    comment: 'CPF do paciente',
  },
  telefone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
    field: 'telefone',
    comment: 'Número do WhatsApp com código do país',
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: true,
    field: 'email',
    validate: {
      isEmail: true,
    },
    comment: 'E-mail do usuário',
  },
  status: {
    type: DataTypes.ENUM('ativo', 'inativo', 'bloqueado'),
    defaultValue: 'ativo',
    field: 'status',
    comment: 'Status do usuário',
  },
  data_cadastro: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'data_cadastro',
    comment: 'Data de cadastro do usuário',
  },
}, {
  tableName: 'usuarios',
  timestamps: false,
  indexes: [
    {
      fields: ['telefone'],
    },
    {
      fields: ['email'],
    },
  ],
});

module.exports = Usuario;
