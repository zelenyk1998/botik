require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User, GasStation, FuelType } = require('../models');

const seed = async () => {
  try {
    // Створення адміністратора
    const adminExists = await User.findOne({ where: { username: 'admin' } });
    
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('123123', salt);
      
      await User.create({
        username: 'admin',
        password: '123123',
        is_admin: true,
        first_name: 'Admin',
        last_name: 'User'
      });
      
      console.log('Admin user created successfully');
    }
    
    // Створення мереж АЗС
    const wogExists = await GasStation.findOne({ where: { name: 'WOG' } });
    
    if (!wogExists) {
      await GasStation.create({
        name: 'WOG',
        isActive: true
      });
      
      console.log('WOG gas station created successfully');
    }
    
    const okkoExists = await GasStation.findOne({ where: { name: 'OKKO' } });
    
    if (!okkoExists) {
      await GasStation.create({
        name: 'OKKO',
        isActive: true
      });
      
      console.log('OKKO gas station created successfully');
    }
    
    // Створення типів пального
    const a95Exists = await FuelType.findOne({ where: { code: 'A95' } });
    
    if (!a95Exists) {
      await FuelType.create({
        name: 'Бензин А-95',
        code: 'A95',
        isActive: true
      });
      
      console.log('A95 fuel type created successfully');
    }
    
    const dieselExists = await FuelType.findOne({ where: { code: 'DIESEL' } });
    
    if (!dieselExists) {
      await FuelType.create({
        name: 'Дизель',
        code: 'DIESEL',
        isActive: true
      });
      
      console.log('Diesel fuel type created successfully');
    }
    
    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  }
};

seed();