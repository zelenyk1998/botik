const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const Voucher = require('../models/Voucher');
const Transaction = require('../models/Transaction');

// GET /api/vouchers - Отримати всі талони (тільки для адміна)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const { status, gasStation, fuelType } = req.query;
    
    // Підготовка фільтрів
    const filter = {};
    
    if (status === 'available') {
      filter.owner = null;
      filter.isUsed = false;
      filter.expirationDate = { $gt: new Date() };
    } else if (status === 'sold') {
      filter.owner = { $ne: null };
      filter.isUsed = false;
    } else if (status === 'used') {
      filter.isUsed = true;
    } else if (status === 'expired') {
      filter.owner = { $ne: null };
      filter.isUsed = false;
      filter.expirationDate = { $lt: new Date() };
    }
    
    if (gasStation) {
      filter.gasStation = gasStation;
    }
    
    if (fuelType) {
      filter.fuelType = fuelType;
    }
    
    const vouchers = await Voucher.findAll(filter)
      .populate('gasStation')
      .populate('fuelType')
      .populate('owner', 'telegramId firstName lastName username')
      .sort({ createdAt: -1 });
    
    res.json(vouchers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/vouchers/stats - Отримати статистику талонів (тільки для адміна)
router.get('/stats', [auth, adminAuth], async (req, res) => {
  try {
    const stats = {
      total: await Voucher.countDocuments(),
      available: await Voucher.countDocuments({
        owner: null,
        isUsed: false,
        expirationDate: { $gt: new Date() }
      }),
      sold: await Voucher.countDocuments({
        owner: { $ne: null },
        isUsed: false
      }),
      used: await Voucher.countDocuments({ isUsed: true }),
      expired: await Voucher.countDocuments({
        owner: { $ne: null },
        isUsed: false,
        expirationDate: { $lt: new Date() }
      })
    };
    
    res.json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// GET /api/vouchers/transactions - Отримати всі транзакції (тільки для адміна)
router.get('/transactions', [auth, adminAuth], async (req, res) => {
  try {
    const transactions = await Transaction.findAll()
      .populate('user', 'telegramId firstName lastName username phoneNumber')
      .populate({
        path: 'vouchers',
        populate: [
          { path: 'gasStation' },
          { path: 'fuelType' }
        ]
      })
      .sort({ createdAt: -1 });
    
    res.json(transactions);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;