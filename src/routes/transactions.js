const express = require('express');
const router = express.Router();
const { Transaction, User, Voucher, GasStation, FuelType } = require('../models');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// Застосовуємо middleware авторизації та адмін-доступу
router.use(auth);
router.use(adminAuth);

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

module.exports = router;