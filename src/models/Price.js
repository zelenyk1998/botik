const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const Price = sequelize.define('Price', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // Зв'язок з GasStation буде встановлено через foreignKey
  // gas_station_id
  
  // Зв'язок з FuelType буде встановлено через foreignKey
  // fuel_type_id
  
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'prices',
  timestamps: true,
  underscored: true
});

module.exports = Price;