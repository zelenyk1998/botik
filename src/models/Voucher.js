const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const Voucher = sequelize.define('Voucher', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  gas_station_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'gas_stations',
      key: 'id'
    }
  },
  fuel_type_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'fuel_types',
      key: 'id'
    }
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  purchase_price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  is_used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  used_at: {
    type: DataTypes.DATE
  },
  expiration_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  purchased_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'vouchers',
  timestamps: true,
  underscored: true
});

module.exports = Voucher;