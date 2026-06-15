const { DataTypes } = require('sequelize');
const Database = require('../database/connection');

const sequelize = Database.getInstance();

// Mapeia para tabela `pagamentos` do schema
const Pagamento = sequelize.define('Pagamento', {
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
  orcamento_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'orcamento_id',
  },
  consulta_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
    field: 'consulta_id',
  },
  valor: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
    field: 'valor',
  },
  forma_pagamento: {
    type: DataTypes.ENUM('dinheiro','cartao_debito','cartao_credito','pix','boleto','outro'),
    allowNull: false,
    field: 'forma_pagamento',
  },
  parcelas: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: true,
    defaultValue: 1,
    field: 'parcelas',
  },
  juros: {
    type: DataTypes.DECIMAL(5,2),
    allowNull: true,
    defaultValue: 0.00,
    field: 'juros',
  },
  status: {
    type: DataTypes.ENUM('agendado','realizado','cancelado'),
    allowNull: false,
    defaultValue: 'realizado',
    field: 'status',
  },
  data_vencimento: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'data_vencimento',
  },
  data_pagamento: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'data_pagamento',
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
  tableName: 'pagamentos',
  timestamps: false,
});

module.exports = Pagamento;
