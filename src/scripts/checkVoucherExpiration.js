// Файл: scripts/checkVoucherExpiration.js
require('dotenv').config({ path: '../.env' }); // Шлях до .env файлу може відрізнятися
const { Sequelize, Op } = require('sequelize');
const TelegramBot = require('node-telegram-bot-api');
const { User, Voucher, GasStation, FuelType } = require('../models');

// Ініціалізація бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

async function checkVoucherExpiration(testMode = false) {
  try {
    console.log('Запуск перевірки термінів дії талонів...');
    
    // Поточна дата
    const currentDate = new Date();
    
    // Для тестування: якщо у нас є конкретна дата закінчення, яку треба перевірити
    let targetDate;
    let whereCondition;
    
    if (testMode) {
      console.log('Запущено в тестовому режимі. Перевірка талонів за конкретною датою.');
      
      // Наприклад, перевіряємо талони до 21.03.2025
      targetDate = new Date('2025-03-21');
      console.log(`Цільова дата закінчення: ${targetDate.toISOString().split('T')[0]}`);
      
      whereCondition = {
        // Не використані талони
        is_used: false,
        // З власником
        owner_id: {
          [Op.ne]: null
        },
        // Талони з конкретною датою закінчення
        expiration_date: {
          [Op.between]: [
            new Date(targetDate.setHours(0, 0, 0, 0)), 
            new Date(targetDate.setHours(23, 59, 59, 999))
          ]
        }
      };
    } else {
      // Дата через 7 днів для звичайного режиму
      const inSevenDays = new Date();
      inSevenDays.setDate(currentDate.getDate() + 7);
      console.log(`Поточна дата: ${currentDate.toISOString().split('T')[0]}`);
      console.log(`Дата через 7 днів: ${inSevenDays.toISOString().split('T')[0]}`);
      
      whereCondition = {
        // Не використані талони
        is_used: false,
        // З власником
        owner_id: {
          [Op.ne]: null
        },
        // Термін дії закінчується через 7 днів
        expiration_date: {
          [Op.between]: [
            new Date(inSevenDays.setHours(0, 0, 0, 0)),
            new Date(inSevenDays.setHours(23, 59, 59, 999))
          ]
        }
      };
    }
    
    // Виводимо SQL-запит для діагностики
    console.log('SQL-запит для пошуку талонів:');
    console.log(JSON.stringify(whereCondition, null, 2));
    
    // Знаходимо талони із заданими умовами
    const expiringVouchers = await Voucher.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'telegram_id', 'first_name', 'last_name']
        },
        {
          model: GasStation,
          as: 'gasStation',
          attributes: ['id', 'name']
        },
        {
          model: FuelType,
          as: 'fuelType',
          attributes: ['id', 'name']
        }
      ]
    });
    
    console.log(`Знайдено ${expiringVouchers.length} талонів з терміном дії, що закінчується`);
    
    // Виводимо дані про знайдені талони для діагностики
    if (expiringVouchers.length > 0) {
      console.log('Знайдені талони:');
      expiringVouchers.forEach((voucher, index) => {
        console.log(`${index + 1}. Талон ID: ${voucher.id}, Код: ${voucher.code}`);
        console.log(`   Власник: ${voucher.owner?.first_name || 'Невідомо'} (ID: ${voucher.owner?.telegram_id || 'Немає'})`);
        console.log(`   Мережа: ${voucher.gasStation?.name || 'Невідомо'}`);
        console.log(`   Тип палива: ${voucher.fuelType?.name || 'Невідомо'}`);
        console.log(`   Термін дії до: ${new Date(voucher.expiration_date).toLocaleDateString('uk-UA')}`);
        console.log(`   Використаний: ${voucher.is_used ? 'Так' : 'Ні'}`);
        console.log('---');
      });
    }
    
    // Якщо не знайдено жодного талона, повертаємося
    if (expiringVouchers.length === 0) {
      console.log('Не знайдено талонів, які відповідають критеріям пошуку.');
      return;
    }
    
    // Групуємо талони за користувачами для відправки одного повідомлення на користувача
    const vouchersByUser = {};
    
    for (const voucher of expiringVouchers) {
      if (!voucher.owner || !voucher.owner.telegram_id) {
        console.log(`Пропускаємо талон ${voucher.code} - не знайдено Telegram ID власника`);
        continue;
      }
      
      const userId = voucher.owner.telegram_id;
      
      if (!vouchersByUser[userId]) {
        vouchersByUser[userId] = {
          user: voucher.owner,
          vouchers: []
        };
      }
      
      vouchersByUser[userId].vouchers.push(voucher);
    }
    
    // Якщо тестовий режим, лише показуємо повідомлення без відправки
    if (testMode) {
      console.log('Тестовий режим: повідомлення не будуть відправлені користувачам');
      
      for (const userId in vouchersByUser) {
        const { user, vouchers } = vouchersByUser[userId];
        
        console.log(`\nПовідомлення для користувача ${user.first_name} (ID: ${userId}):`);
        
        let message = `⚠️ *Нагадування про закінчення терміну дії талонів*\n\n`;
        message += `${user.first_name}, у вас є талони, термін дії яких закінчується незабаром:\n\n`;
        
        for (const voucher of vouchers) {
          message += `🎫 *Талон:* ${voucher.code}\n`;
          message += `⛽ *Мережа:* ${voucher.gasStation.name}\n`;
          message += `⚡ *Пальне:* ${voucher.fuelType.name}\n`;
          message += `🔢 *Кількість:* ${voucher.amount} л\n`;
          message += `📅 *Дійсний до:* ${new Date(voucher.expiration_date).toLocaleDateString('uk-UA')}\n\n`;
        }
        
        message += `Не забудьте використати ваші талони вчасно! Щоб переглянути талони, натисніть кнопку "🎫 Мої талони" в головному меню.`;
        
        console.log(message);
      }
      
      return;
    }
    
    // Відправляємо нагадування користувачам
    console.log('Надсилання повідомлень користувачам...');
    for (const userId in vouchersByUser) {
      const { user, vouchers } = vouchersByUser[userId];
      
      // Формуємо повідомлення
      let message = `⚠️ *Нагадування про закінчення терміну дії талонів*\n\n`;
      message += `${user.first_name}, у вас є талони, термін дії яких закінчується через 7 днів:\n\n`;
      
      for (const voucher of vouchers) {
        message += `🎫 *Талон:* ${voucher.code}\n`;
        message += `⛽ *Мережа:* ${voucher.gasStation.name}\n`;
        message += `⚡ *Пальне:* ${voucher.fuelType.name}\n`;
        message += `🔢 *Кількість:* ${voucher.amount} л\n`;
        message += `📅 *Дійсний до:* ${new Date(voucher.expiration_date).toLocaleDateString('uk-UA')}\n\n`;
      }
      
      message += `Не забудьте використати ваші талони вчасно! Щоб переглянути талони, натисніть кнопку "🎫 Мої талони" в головному меню.`;
      
      // Відправляємо повідомлення користувачу
      try {
        await bot.sendMessage(userId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🎫 Переглянути талони', callback_data: 'active_vouchers' }],
              [{ text: '📍 Знайти найближчу АЗС', callback_data: 'find_gas_station' }]
            ]
          }
        });
        console.log(`Надіслано нагадування користувачу ${user.first_name} (ID: ${userId})`);
      } catch (error) {
        console.error(`Помилка надсилання нагадування користувачу ${userId}:`, error.message);
      }
    }
    
    console.log('Перевірку термінів дії талонів завершено');
  } catch (error) {
    console.error('Помилка перевірки термінів дії талонів:', error);
  }
}

// Запускаємо функцію, якщо скрипт запущений напряму
if (require.main === module) {
  // Перевіряємо, чи є параметр --test для запуску в тестовому режимі
  const testMode = process.argv.includes('--test');
  
  checkVoucherExpiration(testMode)
    .then(() => {
      console.log('Скрипт перевірки термінів дії талонів успішно завершено');
      process.exit(0);
    })
    .catch(error => {
      console.error('Помилка виконання скрипту:', error);
      process.exit(1);
    });
} else {
  // Експортуємо функцію для використання в інших модулях
  module.exports = { checkVoucherExpiration };
}