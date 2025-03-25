const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const GasStation = sequelize.define('GasStation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  logo: {
    type: DataTypes.STRING
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'gas_stations',
  timestamps: true,
  underscored: true
});

module.exports = GasStation;