// Файл: scripts/runVoucherCheck.js
// Цей скрипт можна запустити вручну, щоб перевірити як працює система нагадувань

require('dotenv').config();
const { checkVoucherExpiration } = require('./checkVoucherExpiration');

console.log('Запуск ручної перевірки термінів дії талонів...');

checkVoucherExpiration()
  .then(() => {
    console.log('Перевірка термінів дії талонів успішно завершена');
    process.exit(0);
  })
  .catch(error => {
    console.error('Помилка при перевірці:', error);
    process.exit(1);
  });