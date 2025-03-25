const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  total_amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  payment_status: {
    type: DataTypes.ENUM('paid', 'completed', 'failed', 'pending'),
    defaultValue: 'pending'
  },
  payment_method: {
    type: DataTypes.STRING
  },
  payment_details: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true
});

module.exports = Transaction;