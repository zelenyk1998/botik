const { sequelize } = require('../db/config');
const User = require('./User');
const GasStation = require('./GasStation');
const FuelType = require('./FuelType');
const Price = require('./Price');
const Voucher = require('./Voucher');
const Transaction = require('./Transaction');
const TransactionVoucher = require('./TransactionVoucher');
const Message = require('./Message');
const GasStationLocation = require('./GasStationLocation');

// GasStation - Price
GasStation.hasMany(Price, { 
  foreignKey: 'gas_station_id',
  as: 'prices'
});
Price.belongsTo(GasStation, { 
  foreignKey: 'gas_station_id', 
  as: 'gasStation' 
});

// FuelType - Price
FuelType.hasMany(Price, { 
  foreignKey: 'fuel_type_id',
  as: 'prices'
});
Price.belongsTo(FuelType, { 
  foreignKey: 'fuel_type_id', 
  as: 'fuelType' 
});

// GasStation - Voucher
GasStation.hasMany(Voucher, { foreignKey: 'gas_station_id', as: 'vouchers' });
Voucher.belongsTo(GasStation, { foreignKey: 'gas_station_id', as: 'gasStation' });


// FuelType - Voucher
FuelType.hasMany(Voucher, { 
  foreignKey: 'fuel_type_id',
  as: 'vouchers'
});
Voucher.belongsTo(FuelType, { 
  foreignKey: 'fuel_type_id', 
  as: 'fuelType' 
});

// User - Voucher
User.hasMany(Voucher, { 
  foreignKey: 'owner_id',
  as: 'vouchers'
});
Voucher.belongsTo(User, { 
  foreignKey: 'owner_id', 
  as: 'owner' 
});

// User - Transaction
User.hasMany(Transaction, { 
  foreignKey: 'user_id',
  as: 'transactions'
});
Transaction.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

// Transaction - Voucher (many-to-many through TransactionVoucher)
Transaction.belongsToMany(Voucher, { 
  through: TransactionVoucher, 
  foreignKey: 'transaction_id',
  otherKey: 'voucher_id',
  as: 'vouchers'
});
Voucher.belongsToMany(Transaction, { 
  through: TransactionVoucher, 
  foreignKey: 'voucher_id',
  otherKey: 'transaction_id',
  as: 'transactions'
});

// User - Message (messages created by admin)
User.hasMany(Message, { 
  foreignKey: 'created_by',
  as: 'messages'
});
Message.belongsTo(User, { 
  foreignKey: 'created_by', 
  as: 'creator' 
});

GasStation.hasMany(GasStationLocation, { 
  foreignKey: 'gas_station_id',
  as: 'locations'
});
GasStationLocation.belongsTo(GasStation, { 
  foreignKey: 'gas_station_id', 
  as: 'gasStation' 
});

module.exports = {
  sequelize,
  User,
  GasStation,
  FuelType,
  Price,
  Voucher,
  Transaction,
  TransactionVoucher,
  Message,
  GasStationLocation,
};