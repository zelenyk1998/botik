const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { GasStation, FuelType, Price, Voucher, Message, User, Transaction, GasStationLocation, BotMenu } = require('../models');
const { body, validationResult } = require('express-validator');
const { Op, fn, col } = require('sequelize'); 
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { sequelize } = require('../db/config');

router.use(auth);
router.use(adminAuth);

router.get('/bot-menu', [auth, adminAuth], async (req, res) => {
  try {
    const menuItems = await BotMenu.findAll({
      order: [
        ['parent_id', 'ASC'],
        ['position', 'ASC']
      ]
    });
    
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching bot menu:', error);
    res.status(500).json({ message: 'Помилка отримання меню бота' });
  }
});

// POST /api/admin/bot-menu - створити новий пункт меню
router.post('/bot-menu', [auth, adminAuth], async (req, res) => {
  try {
    const { name, command, parent_id, position, icon, action_type, action_data, is_active, requires_auth, requires_admin } = req.body;
    
    const menuItem = await BotMenu.create({
      name,
      command,
      parent_id,
      position,
      icon,
      action_type,
      action_data,
      is_active,
      requires_auth,
      requires_admin
    });
    
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating bot menu item:', error);
    res.status(500).json({ message: 'Помилка створення пункту меню' });
  }
});

// PUT /api/admin/bot-menu/:id - оновити пункт меню
router.put('/bot-menu/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { name, command, parent_id, position, icon, action_type, action_data, is_active, requires_auth, requires_admin } = req.body;
    
    const menuItem = await BotMenu.findByPk(req.params.id);
    
    if (!menuItem) {
      return res.status(404).json({ message: 'Пункт меню не знайдено' });
    }
    
    await menuItem.update({
      name,
      command,
      parent_id,
      position,
      icon,
      action_type,
      action_data,
      is_active,
      requires_auth,
      requires_admin
    });
    
    res.json(menuItem);
  } catch (error) {
    console.error('Error updating bot menu item:', error);
    res.status(500).json({ message: 'Помилка оновлення пункту меню' });
  }
});

// DELETE /api/admin/bot-menu/:id - видалити пункт меню
router.delete('/bot-menu/:id', [auth, adminAuth], async (req, res) => {
  try {
    const menuItem = await BotMenu.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ message: 'Пункт меню не знайдено' });
    }
    
    // Перевіряємо, чи не має цей пункт дочірніх елементів
    const hasChildren = await BotMenu.findOne({
      where: { parent_id: req.params.id }
    });
    
    if (hasChildren) {
      return res.status(400).json({ message: 'Спочатку видаліть або перемістіть дочірні пункти меню' });
    }
    
    await menuItem.destroy();
    
    res.json({ message: 'Пункт меню успішно видалено' });
  } catch (error) {
    console.error('Error deleting bot menu item:', error);
    res.status(500).json({ message: 'Помилка видалення пункту меню' });
  }
});

router.get('/gas-station-locations', async (req, res) => {
  try {
    const { gasStationId } = req.query;
    
    const where = {};
    if (gasStationId) {
      where.gas_station_id = gasStationId;
    }
    
    const locations = await GasStationLocation.findAll({
      where,
      include: [
        { model: GasStation, as: 'gasStation' }
      ],
      order: [['name', 'ASC']]
    });
    
    res.json(locations);
  } catch (err) {
    console.error('Error fetching gas station locations:', err);
    res.status(500).json({ message: 'Помилка отримання локацій АЗС' });
  }
});

// Додавання нової локації АЗС
router.post('/gas-station-locations', [
  body('gasStationId').isInt().withMessage('Gas station ID is required'),
  body('name').not().isEmpty().withMessage('Name is required'),
  body('address').not().isEmpty().withMessage('Address is required'),
  body('city').not().isEmpty().withMessage('City is required'),
  body('latitude').isFloat().withMessage('Valid latitude is required'),
  body('longitude').isFloat().withMessage('Valid longitude is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { 
      gasStationId, 
      name, 
      address, 
      city, 
      region, 
      latitude, 
      longitude, 
      workingHours, 
      services 
    } = req.body;
    
    // Перевіряємо чи існує вказана мережа АЗС
    const gasStation = await GasStation.findByPk(gasStationId);
    if (!gasStation) {
      return res.status(404).json({ message: 'Мережу АЗС не знайдено' });
    }
    
    // Створюємо нову локацію
    const location = await GasStationLocation.create({
      gas_station_id: gasStationId,
      name,
      address,
      city,
      region,
      latitude,
      longitude,
      working_hours: workingHours,
      services,
      is_active: true
    });
    
    // Повертаємо створену локацію разом із даними про мережу
    const locationWithRelations = await GasStationLocation.findByPk(location.id, {
      include: [
        { model: GasStation, as: 'gasStation' }
      ]
    });
    
    res.status(201).json(locationWithRelations);
  } catch (err) {
    console.error('Error creating gas station location:', err);
    res.status(500).json({ message: 'Помилка створення локації АЗС' });
  }
});

// Оновлення локації АЗС
router.put('/gas-station-locations/:id', async (req, res) => {
  try {
    const { 
      name, 
      address, 
      city, 
      region, 
      latitude, 
      longitude, 
      workingHours, 
      services,
      isActive 
    } = req.body;
    
    const location = await GasStationLocation.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Локацію АЗС не знайдено' });
    }
    
    // Оновлюємо дані
    await location.update({
      name: name || location.name,
      address: address || location.address,
      city: city || location.city,
      region: region !== undefined ? region : location.region,
      latitude: latitude || location.latitude,
      longitude: longitude || location.longitude,
      working_hours: workingHours !== undefined ? workingHours : location.working_hours,
      services: services !== undefined ? services : location.services,
      is_active: isActive !== undefined ? isActive : location.is_active
    });
    
    // Повертаємо оновлену локацію з даними про мережу
    const updatedLocation = await GasStationLocation.findByPk(location.id, {
      include: [
        { model: GasStation, as: 'gasStation' }
      ]
    });
    
    res.json(updatedLocation);
  } catch (err) {
    console.error('Error updating gas station location:', err);
    res.status(500).json({ message: 'Помилка оновлення локації АЗС' });
  }
});

// Видалення локації АЗС
router.delete('/gas-station-locations/:id', async (req, res) => {
  try {
    const location = await GasStationLocation.findByPk(req.params.id);
    if (!location) {
      return res.status(404).json({ message: 'Локацію АЗС не знайдено' });
    }
    
    await location.destroy();
    
    res.json({ message: 'Локацію АЗС успішно видалено' });
  } catch (err) {
    console.error('Error deleting gas station location:', err);
    res.status(500).json({ message: 'Помилка видалення локації АЗС' });
  }
});

// Масовий імпорт локацій АЗС (наприклад, з CSV-файлу)
router.post('/gas-station-locations/import', async (req, res) => {
  try {
    const { locations, gasStationId } = req.body;
    
    if (!Array.isArray(locations) || locations.length === 0) {
      return res.status(400).json({ message: 'Потрібно надати масив локацій' });
    }
    
    // Перевіряємо чи існує вказана мережа АЗС
    const gasStation = await GasStation.findByPk(gasStationId);
    if (!gasStation) {
      return res.status(404).json({ message: 'Мережу АЗС не знайдено' });
    }
    
    // Створюємо всі локації
    const createdLocations = await Promise.all(
      locations.map(location => 
        GasStationLocation.create({
          gas_station_id: gasStationId,
          name: location.name,
          address: location.address,
          city: location.city,
          region: location.region,
          latitude: location.latitude,
          longitude: location.longitude,
          working_hours: location.workingHours,
          services: location.services,
          is_active: true
        })
      )
    );
    
    res.status(201).json({
      message: `Успішно імпортовано ${createdLocations.length} локацій`,
      count: createdLocations.length
    });
  } catch (err) {
    console.error('Error importing gas station locations:', err);
    res.status(500).json({ message: 'Помилка імпорту локацій АЗС' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    // Статистика талонів
    const vouchersStats = {
      total: await Voucher.count(),
      available: await Voucher.count({
        where: {
          owner_id: null,
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        }
      }),
      sold: await Voucher.count({
        where: {
          owner_id: { [Op.ne]: null },
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        }
      }),
      used: await Voucher.count({ 
        where: { is_used: true }
      }),
      expired: await Voucher.count({
        where: {
          owner_id: { [Op.ne]: null },
          is_used: false,
          expiration_date: { [Op.lt]: new Date() }
        }
      })
    };

    // Статистика транзакцій
    const transactionsStats = {
      total: await Transaction.count(),
      paid: await Transaction.count({ where: { payment_status: 'paid' } }),
      pending: await Transaction.count({ where: { payment_status: 'pending' } }),
      failed: await Transaction.count({ where: { payment_status: 'failed' } })
    };

    // Статистика по користувачах
    const usersStats = {
      totalUsers: await User.count(),
      activeUsers: await User.count({
        where: { last_active: { [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000) } } // користувачі, які були активні протягом останніх 24 годин
      })
    };

    // Загальна статистика
    res.json({
      vouchersStats,
      transactionsStats,
      usersStats
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Помилка отримання статистики для дашборду' });
  }
});


// GET /api/admin/gas-stations - Отримати всі мережі АЗС
router.get('/gas-stations', async (req, res) => {
  try {
    const gasStations = await GasStation.findAll();
    res.json(gasStations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка отримання АЗС' });
  }
});

// POST /api/admin/gas-stations - Створити нову мережу АЗС
router.post('/gas-stations', [
  body('name').not().isEmpty().withMessage('Name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, logo } = req.body;
    const [gasStation, created] = await GasStation.findOrCreate({
      where: { name },
      defaults: { name, logo, isActive: true }
    });

    if (!created) {
      return res.status(400).json({ message: 'АЗС вже існує' });
    }

    res.json(gasStation);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

// PUT /api/admin/gas-stations/:id - Оновити мережу АЗС
router.put('/gas-stations/:id', async (req, res) => {
  try {
    const { name, logo, is_active } = req.body;
    const gasStation = await GasStation.findByPk(req.params.id);

    if (!gasStation) {
      return res.status(404).json({ message: 'АЗС не знайдено' });
    }

    // Переконайтеся, що is_active включено тут
    await gasStation.update({ name, logo, is_active });
    res.json(gasStation);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

// GET /api/admin/fuel-types - Отримати всі види пального
router.get('/fuel-types', async (req, res) => {
  try {
    const fuelTypes = await FuelType.findAll({ order: [['name', 'ASC']] });
    res.json(fuelTypes);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

// POST /api/admin/fuel-types - Створити новий вид пального
router.post('/fuel-types', [
  body('name').not().isEmpty().withMessage('Name is required'),
  body('code').not().isEmpty().withMessage('Code is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, code } = req.body;
    const [fuelType, created] = await FuelType.findOrCreate({
      where: { name },
      defaults: { name, code, isActive: true }
    });

    if (!created) {
      return res.status(400).json({ message: 'Вид пального вже існує' });
    }

    res.json(fuelType);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

router.put('/fuel-types/:id', async (req, res) => {
  try {
    const { name, code, is_active } = req.body;
    const fuelType = await FuelType.findByPk(req.params.id);

    if (!fuelType) {
      return res.status(404).json({ message: 'Вид пального не знайдено' });
    }

    await fuelType.update({ name, code, is_active });
    res.json(fuelType);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

router.get('/prices', async (req, res) => {
  try {
    const prices = await Price.findAll({
      include: [
        { model: GasStation, as: 'gasStation' },
        { model: FuelType, as: 'fuelType' }
      ]
    });
    res.json(prices);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

// POST /api/admin/prices - Створити нову ціну
router.post('/prices', [
  body('gasStation').not().isEmpty().withMessage('Gas station is required'),
  body('fuelType').not().isEmpty().withMessage('Fuel type is required'),
  body('amount').not().isEmpty().withMessage('Amount is required'),
  body('price').not().isEmpty().withMessage('Price is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { gasStation, fuelType, amount, price, isActive } = req.body;
    
    // Перевірка чи існує вже така ціна
    const existingPrice = await Price.findOne({
      where: {
        gas_station_id: gasStation,
        fuel_type_id: fuelType,
        amount: amount
      }
    });

    if (existingPrice) {
      return res.status(400).json({ message: 'Така ціна вже існує' });
    }

    const newPrice = await Price.create({
      gas_station_id: gasStation,
      fuel_type_id: fuelType,
      amount,
      price,
      is_active: isActive
    });

    // Отримання повних даних для відповіді
    const priceWithRelations = await Price.findByPk(newPrice.id, {
      include: [
        { model: GasStation, as: 'gasStation' },
        { model: FuelType, as: 'fuelType' }
      ]
    });

    res.json(priceWithRelations);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

// PUT /api/admin/prices/:id - Оновити ціну
router.put('/prices/:id', async (req, res) => {
  try {
    const { price, isActive } = req.body;
    const priceRecord = await Price.findByPk(req.params.id);

    if (!priceRecord) {
      return res.status(404).json({ message: 'Ціну не знайдено' });
    }

    await priceRecord.update({
      price,
      is_active: isActive
    });

    // Отримання оновлених даних з зв'язками
    const updatedPrice = await Price.findByPk(priceRecord.id, {
      include: [
        { model: GasStation, as: 'gasStation' },
        { model: FuelType, as: 'fuelType' }
      ]
    });

    res.json(updatedPrice);
  } catch (err) {
    console.error(err);
    res.status(500).send('Помилка сервера');
  }
});

router.get('/vouchers', async (req, res) => {
  try {
    const { status, gasStation, fuelType } = req.query;
    
    // Підготовка фільтрів
    const filter = {};
    
    if (status === 'available') {
      filter.owner_id = null;
      filter.is_used = false;
      filter.expiration_date = { [Op.gt]: new Date() };
    } else if (status === 'sold') {
      filter.owner_id = { [Op.ne]: null };
      filter.is_used = false;
    } else if (status === 'used') {
      filter.is_used = true;
    } else if (status === 'expired') {
      filter.owner_id = { [Op.ne]: null };
      filter.is_used = false;
      filter.expiration_date = { [Op.lt]: new Date() };
    }
    
    if (gasStation) {
      filter.gas_station_id = gasStation;
    }
    
    if (fuelType) {
      filter.fuel_type_id = fuelType;
    }
    
    // Додаємо логування для відладки
    console.log('Voucher filter:', filter);
    
    const vouchers = await Voucher.findAll({
      where: filter,
      include: [
        { model: GasStation, as: 'gasStation' },
        { model: FuelType, as: 'fuelType' },
        { 
          model: User, 
          as: 'owner', 
          attributes: ['id', 'telegram_id', 'first_name', 'last_name', 'username'] 
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Додаємо логування для перевірки результатів
    console.log(`Found ${vouchers.length} vouchers matching criteria`);
    
    res.json(vouchers);
  } catch (err) {
    console.error('Error fetching vouchers:', err);
    res.status(500).json({ message: 'Помилка отримання талонів' });
  }
});

// Додайте код для отримання статистики, якщо він не існує
// GET /api/admin/vouchers/stats - Отримати статистику талонів
router.get('/vouchers/stats', async (req, res) => {
  try {
    const stats = {
      total: await Voucher.count(),
      available: await Voucher.count({
        where: {
          owner_id: null,
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        }
      }),
      sold: await Voucher.count({
        where: {
          owner_id: { [Op.ne]: null },
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        }
      }),
      used: await Voucher.count({ 
        where: { is_used: true }
      }),
      expired: await Voucher.count({
        where: {
          owner_id: { [Op.ne]: null },
          is_used: false,
          expiration_date: { [Op.lt]: new Date() }
        }
      })
    };
    
    // Додаємо логування для перевірки
    console.log('Voucher stats:', stats);
    
    res.json(stats);
  } catch (err) {
    console.error('Error fetching voucher stats:', err);
    res.status(500).json({ message: 'Помилка отримання статистики талонів' });
  }
});

router.post('/vouchers/upload', async (req, res) => {
  try {
    const { vouchers } = req.body;
    
    if (!vouchers || !Array.isArray(vouchers) || vouchers.length === 0) {
      return res.status(400).json({ message: 'Необхідно надати масив талонів' });
    }
    
    // Лічильники результатів
    let added = 0;
    let failed = 0;
    
    // Додаємо детальне логування для відлагодження
    console.log(`Отримано ${vouchers.length} талонів для завантаження`);
    
    // Обробка кожного талона
    for (const voucherData of vouchers) {
      try {
        // Перевірка наявності обов'язкових полів
        if (!voucherData.code || !voucherData.gasStation || !voucherData.fuelType || 
            !voucherData.amount || !voucherData.expirationDate) {
          console.log(`Не вдалося додати талон через відсутність обов'язкових полів:`, voucherData);
          failed++;
          continue;
        }
        
        // Перевірка унікальності коду талона
        const existingVoucher = await Voucher.findOne({ 
          where: { code: voucherData.code }
        });
        
        if (existingVoucher) {
          console.log(`Талон з кодом ${voucherData.code} вже існує`);
          failed++;
          continue;
        }
        
        // Отримання ціни, якщо не вказана
        let purchasePrice = voucherData.purchasePrice;
        
        if (!purchasePrice) {
          // Шукаємо актуальну ціну для цієї комбінації АЗС/пального/кількості
          const priceRecord = await Price.findOne({
            where: {
              gas_station_id: voucherData.gasStation,
              fuel_type_id: voucherData.fuelType,
              amount: voucherData.amount,
              is_active: true
            }
          });
          
          if (priceRecord) {
            purchasePrice = priceRecord.price;
            console.log(`Знайдено ціну ${purchasePrice} для талона ${voucherData.code}`);
          } else {
            // Якщо ціни з точною кількістю немає, шукаємо будь-яку ціну для цієї АЗС/пального
            const anyPrice = await Price.findOne({
              where: {
                gas_station_id: voucherData.gasStation,
                fuel_type_id: voucherData.fuelType,
                is_active: true
              }
            });
            
            if (anyPrice) {
              // Розраховуємо пропорційну ціну
              purchasePrice = (anyPrice.price / anyPrice.amount) * voucherData.amount;
              console.log(`Розраховано ціну ${purchasePrice} для талона ${voucherData.code} на основі ціни ${anyPrice.price} за ${anyPrice.amount} л`);
            } else {
              console.log(`Не знайдено ціни для талона ${voucherData.code}`);
              // Якщо ціни немає взагалі, встановлюємо базову ціну (можна змінити за потреби)
              purchasePrice = voucherData.amount * 40; // Базова ціна 40 грн/л
              console.log(`Встановлено базову ціну ${purchasePrice} для талона ${voucherData.code}`);
            }
          }
        }
        
        // Перевірка типу даних для дати
        let expirationDate = voucherData.expirationDate;
        if (typeof expirationDate === 'string') {
          expirationDate = new Date(expirationDate);
        }
        
        // Створення нового талона
        const newVoucher = await Voucher.create({
          code: voucherData.code,
          gas_station_id: voucherData.gasStation,
          fuel_type_id: voucherData.fuelType,
          amount: voucherData.amount,
          purchase_price: purchasePrice,
          expiration_date: expirationDate,
          is_used: false
        });
        
        console.log(`Додано талон: ${newVoucher.code}`);
        added++;
      } catch (err) {
        console.error('Error adding voucher:', err);
        console.error('Voucher data:', voucherData);
        failed++;
      }
    }
    
    console.log(`Результати завантаження: додано ${added}, помилок ${failed}`);
    res.json({ added, failed });
  } catch (err) {
    console.error('Error uploading vouchers:', err);
    res.status(500).json({ message: 'Помилка завантаження талонів' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']]
    });
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Помилка отримання користувачів' });
  }
});

// PUT /api/admin/users/:id - Оновити користувача
router.put('/users/:id', async (req, res) => {
  try {
    const { first_name, last_name, username, phone_number, is_admin } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Оновлюємо тільки дозволені поля
    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (username !== undefined) updateData.username = username;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (is_admin !== undefined) updateData.is_admin = is_admin;

    await user.update(updateData);
    
    // Повертаємо оновлені дані без паролю
    const updatedUser = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    
    res.json(updatedUser);
  } catch (err) {
    console.error('Error updating user:', err);
    
    // Перевірка на помилку дублікату унікальних полів
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Користувач з таким логіном вже існує' });
    }
    
    res.status(500).json({ message: 'Помилка оновлення користувача' });
  }
});
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search, startDate, endDate, status, paymentMethod } = req.query;

    // Базові умови для запиту
    const where = {};
    
    // Фільтр за пошуком
    if (search) {
      where[Op.or] = [
        { '$user.first_name$': { [Op.iLike]: `%${search}%` } },
        { '$user.last_name$': { [Op.iLike]: `%${search}%` } },
        { id: !isNaN(search) ? parseInt(search) : null }
      ];
    }
    
    // Фільтр за датою
    if (startDate) {
      where.created_at = {
        ...where.created_at,
        [Op.gte]: new Date(startDate)
      };
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      
      where.created_at = {
        ...where.created_at,
        [Op.lte]: endDateTime
      };
    }
    
    // Фільтр за статусом оплати
    if (status) {
      where.payment_status = status;
    }
    
    // Фільтр за методом оплати
    if (paymentMethod) {
      where.payment_method = paymentMethod;
    }

    // Пагінація
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Отримання транзакцій з бази даних
    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'telegram_id', 'first_name', 'last_name']
        },
        {
          model: Voucher,
          as: 'vouchers',
          include: [
            { model: GasStation, as: 'gasStation' },
            { model: FuelType, as: 'fuelType' }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });
    
    // Повертаємо результат
    res.json({
      transactions,
      totalCount: count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ message: 'Помилка отримання транзакцій' });
  }
});

const upload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads/messages');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, `message-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Перевірка типу файлу
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Невірний формат зображення'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

router.post('/messages', 
  [auth, adminAuth, upload.single('image')], 
  async (req, res) => {
    try {
      const { title, content, sentTo } = req.body;
      // Видалено selectedUsers з деструктуризації
      const currentUser = req.user;

      // Створення запису повідомлення в базі даних з використанням тільки існуючих полів
      const message = await Message.create({
        title,
        content,
        sent_to: sentTo,
        sent_count: 0,  // Встановлюємо початкове значення
        image_path: req.file ? req.file.path : null
      });

      // Ініціалізація бота
      const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

      // Підготовка фільтра для користувачів
      let userFilter = {
        where: {
          telegram_id: { [Op.ne]: null }
        }
      };

      // Логіка фільтрації користувачів
      switch (sentTo) {
        case 'active':
          userFilter.where.id = {
            [Op.in]: await sequelize.query(`
              SELECT DISTINCT user_id 
              FROM transactions 
              WHERE created_at >= NOW() - INTERVAL '1 month'
            `, { type: sequelize.QueryTypes.SELECT }).then(rows => rows.map(row => row.user_id))
          };
          break;
        case 'inactive':
          userFilter.where.id = {
            [Op.notIn]: await sequelize.query(`
              SELECT DISTINCT user_id 
              FROM transactions 
              WHERE created_at >= NOW() - INTERVAL '1 month'
            `, { type: sequelize.QueryTypes.SELECT }).then(rows => rows.map(row => row.user_id))
          };
          break;
        case 'specific':
          // Парсимо масив обраних користувачів, якщо він є
          const selectedUsers = req.body.selectedUsers;
          const parsedSelectedUsers = selectedUsers ? JSON.parse(selectedUsers) : [];
          
          if (parsedSelectedUsers.length > 0) {
            userFilter.where.id = {
              [Op.in]: parsedSelectedUsers
            };
          } else {
            return res.status(400).json({ message: 'Не вибрано жодного користувача для надсилання' });
          }
          break;
      }

      // Отримання користувачів для розсилки
      const users = await User.findAll(userFilter);

      // Лічильники розсилки
      let sentCount = 0;
      let failedCount = 0;

      // Розсилка повідомлень
      for (const user of users) {
        try {
          if (req.file) {
            // Надсилання повідомлення з зображенням
            await bot.sendPhoto(user.telegram_id, req.file.path, {
              caption: `*${title}*\n\n${content}`,
              parse_mode: 'Markdown'
            });
          } else {
            // Надсилання текстового повідомлення
            await bot.sendMessage(user.telegram_id, `*${title}*\n\n${content}`, {
              parse_mode: 'Markdown'
            });
          }
          sentCount++;
        } catch (sendError) {
          console.error(`Помилка надсилання повідомлення користувачу ${user.id}:`, sendError);
          failedCount++;
        }
      }

      // Оновлення статистики надісланих повідомлень
      await message.update({
        sent_count: sentCount
      });

      // Видалення тимчасового файлу після розсилки
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      res.json({ 
        message: 'Розсилка виконана', 
        sentCount, 
        failedCount 
      });

    } catch (err) {
      console.error('Помилка розсилки:', err);
      
      // Видалення тимчасового файлу у разі помилки
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ message: 'Помилка при розсилці повідомлень' });
    }
  }
);




module.exports = router;