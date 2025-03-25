const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const TransactionVoucher = sequelize.define('TransactionVoucher', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  transaction_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'transactions',
      key: 'id'
    }
  },
  voucher_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'vouchers',
      key: 'id'
    }
  },
  price_at_purchase: {
    type: DataTypes.FLOAT,  // Ціна талона на момент покупки
    allowNull: false
  }
}, {
  tableName: 'transaction_vouchers',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'transaction_voucher_transaction_id_idx',
      fields: ['transaction_id']
    },
    {
      name: 'transaction_voucher_voucher_id_idx',
      fields: ['voucher_id']
    },
    {
      unique: true,
      fields: ['transaction_id', 'voucher_id']
    }
  ]
});

module.exports = TransactionVoucher;