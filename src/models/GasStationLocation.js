const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const GasStationLocation = sequelize.define('GasStationLocation', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  gas_station_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'gas_stations',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  region: {
    type: DataTypes.STRING,
    allowNull: true
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  working_hours: {
    type: DataTypes.STRING,
    allowNull: true
  },
  services: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  tableName: 'gas_station_locations',
  timestamps: true,
  underscored: true
});

module.exports = GasStationLocation;