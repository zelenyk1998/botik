require('dotenv').config();
const { sequelize } = require('./config');
const { User, GasStation, FuelType, Price, Voucher, Transaction, Message, GasStationLocation } = require('../models');

const migrate = async () => {
  try {
    // Синхронізація моделей з базою даних
    // force: true - видаляє існуючі таблиці і створює їх заново (для розробки)
    // force: false - не видаляє таблиці, якщо вони вже існують
    await sequelize.sync({ force: false });
    console.log('Database migrations completed successfully.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during migrations:', error);
    process.exit(1);
  }
};

migrate();
