// Файл: scheduler.js
require('dotenv').config();
const schedule = require('node-schedule');
const { checkVoucherExpiration } = require('./scripts/checkVoucherExpiration');

// Функція запуску планувальника
function startScheduler() {
  console.log('Запуск планувальника завдань...');
  
  // Планування перевірки терміну дії талонів кожного дня о 10:00
  const voucherExpirationJob = schedule.scheduleJob('0 10 * * *', async function() {
    console.log('Запуск запланованої перевірки термінів дії талонів:', new Date());
    try {
      await checkVoucherExpiration();
      console.log('Перевірка термінів дії талонів завершена успішно');
    } catch (error) {
      console.error('Помилка виконання перевірки термінів дії талонів:', error);
    }
  });
  
  console.log('Планувальник завдань запущено. Перевірка термінів дії талонів буде відбуватися щодня о 10:00');
  
  // Повертаємо об'єкти завдань для можливого керування ззовні
  return {
    voucherExpirationJob
  };
}

// Експортуємо функцію для використання в інших модулях
module.exports = { startScheduler };

// Якщо скрипт запущений напряму, запускаємо планувальник
if (require.main === module) {
  startScheduler();
}