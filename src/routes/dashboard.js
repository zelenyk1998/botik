const express = require('express');
const router = express.Router();
const { Transaction, User, Voucher, GasStation, FuelType } = require('../models');
const { Op } = require('sequelize');

// Визначення статистики для дашборду
router.get('/stats', async (req, res) => {
  try {
    // Загальна статистика по користувачам
    const userStats = await User.findAll({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalUsers'],
        [Sequelize.fn('SUM', Sequelize.col('turnover')), 'totalMoney'], // Оборот
        [Sequelize.fn('SUM', Sequelize.col('total_liters')), 'totalLiters'], // Всього літрів
        [Sequelize.fn('AVG', Sequelize.col('average_check')), 'avgAmount'], // Середній чек
      ],
    });

    // Статистика по продажам по днях
    const salesByDate = await Transaction.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('created_at')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: ['date'],
      order: [['date', 'DESC']],
    });

    // Статистика по нових користувачах
    const newUsersByDate = await User.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('joined_date')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: ['date'],
      order: [['date', 'DESC']],
    });

    // Статистика по талонах
    const vouchersByDate = await Voucher.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('created_at')), 'date'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      group: ['date'],
      order: [['date', 'DESC']],
    });

    // Повертаємо зібрану статистику
    res.json({
      userStats: {
        totalUsers: userStats[0].totalUsers,
        turnover: {
          totalMoney: userStats[0].totalMoney,
          totalLiters: userStats[0].totalLiters,
        },
        averageCheck: {
          avgAmount: userStats[0].avgAmount,
        },
        salesByDate,
        newUsersByDate,
      },
      voucherStats: {
        vouchersByDate,
      },
    });
  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ message: 'Помилка отримання статистики для дашборду' });
  }
});

module.exports = router;
