const winston = require('winston');
const config = require('../config/config');

// Створення логера з налаштуваннями
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-bot' },
  transports: [
    // Логування в консоль
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    
    // Логування у файл
    new winston.transports.File({ 
      filename: config.logging.file,
      handleExceptions: true
    })
  ]
});

module.exports = logger;