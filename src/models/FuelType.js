const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const FuelType = sequelize.define('FuelType', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'fuel_types',
  timestamps: true,
  underscored: true
});

module.exports = FuelType;