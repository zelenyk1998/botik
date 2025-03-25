require('dotenv').config();

module.exports = {
  // Налаштування Telegram Bot
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    polling: true
  },
  
  // Налаштування бази даних
  database: {
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  },
  
  // Налаштування платіжної системи
  payment: {
    apiSign: process.env.NOVAPAY_API_SIGN,
    MERCHANT_ID: process.env.NOVAPAY_MERCHANT_ID
  },

   // Налаштування аі асистента
   aiAssist: {
    apiKey: process.env.OPENROUTER_API_KEY,
    siteUrl: process.env.SITE_URL,
    siteName: process.env.SITE_NAME
  },
  
  // Налаштування логування
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'app.log'
  }
};