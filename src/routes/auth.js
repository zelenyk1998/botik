const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const auth = require('../middleware/auth');

// Middleware для валідації даних
const loginValidation = [
  body('username').not().isEmpty().withMessage('Username is required'),
  body('password').not().isEmpty().withMessage('Password is required')
];

// POST /api/auth/login - Admin login
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());  // Логування помилок валідації
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  try {
    console.log(`Attempting login for username: ${username}`);  // Логування спроби входу

    // Знаходимо адміністратора за ім'ям користувача
    const admin = await User.findOne({ 
      where: { 
        username, 
        is_admin: true 
      }
    });
    
    if (!admin) {
      console.error('Admin not found'); 
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Перевіряємо пароль
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      console.error('Invalid password');  // Логування помилки неправильного пароля
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Створюємо JWT токен
    const payload = {
      user: {
        id: admin.id,
        isAdmin: admin.is_admin
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '12h' },
      (err, token) => {
        if (err) {
          console.error('Error signing token:', err);  // Логування помилки під час підписання токену
          throw err;
        }
        console.log('Login successful, token generated');  // Логування успішного входу
        res.json({ token });
      }
    );
  } catch (err) {
    console.error('Server error:', err.message);  // Логування загальних помилок сервера
    res.status(500).send('Server error');
  }
});

// GET /api/auth/user - Get admin info
router.get('/user', auth, async (req, res) => {
  try {
    console.log(`Fetching user information for user ID: ${req.user.id}`);  // Логування запиту до інформації користувача

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (user) {
      console.log('User found:', user);  // Логування знайденого користувача
      res.json(user);
    } else {
      console.error('User not found');  // Логування помилки, якщо користувач не знайдений
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Server error:', err.message);  // Логування помилки сервера
    res.status(500).send('Server error');
  }
});

module.exports = router;
