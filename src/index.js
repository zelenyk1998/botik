// Файл: index.js
// Додайте цей код до вашого існуючого index.js після запуску сервера

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize, testConnection } = require('./db/config');
const botSetup = require('./telegram/bot');
const { startScheduler } = require('./scheduler'); // Імпортуємо функцію запуску планувальника

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const vouchers = require('./routes/vouchers');
const webhookRoutes = require('./routes/api/webhooks');
const transactionsRoutes = require('./routes/transactions');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000;
const corsOptions = {
  origin: ['https://admin-panel-1-n2qi.onrender.com', 'http://localhost:3001'],
  methods: 'GET,POST,PUT,DELETE',
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Тестування підключення до бази даних
testConnection();

// Setup routes
app.use('/api/admin/transactions', transactionsRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vouchers', vouchers);

// Initialize Telegram bot
const bot = botSetup();

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Запускаємо планувальник завдань після запуску сервера
  const scheduledJobs = startScheduler();
  console.log('Планувальник завдань запущено');
  
  // Зберігаємо планувальник у глобальному об'єкті для доступу в інших частинах програми
  global.scheduledJobs = scheduledJobs;
});

// Правильне завершення роботи при зупинці програми
process.on('SIGTERM', () => {
  console.log('Отримано сигнал SIGTERM. Закриття сервера...');
  server.close(() => {
    console.log('Сервер закрито');
    
    // Скасування всіх запланованих завдань
    if (global.scheduledJobs) {
      console.log('Закриття запланованих завдань...');
      for (const jobName in global.scheduledJobs) {
        if (global.scheduledJobs[jobName]) {
          global.scheduledJobs[jobName].cancel();
        }
      }
    }
    
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Отримано сигнал SIGINT. Закриття сервера...');
  server.close(() => {
    console.log('Сервер закрито');
    
    // Скасування всіх запланованих завдань
    if (global.scheduledJobs) {
      console.log('Закриття запланованих завдань...');
      for (const jobName in global.scheduledJobs) {
        if (global.scheduledJobs[jobName]) {
          global.scheduledJobs[jobName].cancel();
        }
      }
    }
    
    process.exit(0);
  });
});