const UserController = require('../controllers/userController');
const logger = require('../utils/logger');

module.exports = (bot, sessionService) => {
  // Обробник кнопки "Мій профіль"
  bot.onText(/👤 Мій профіль/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Пошук користувача
      const user = await UserController.findUserByTelegramId(msg.from.id.toString());
      
      if (!user) {
        return bot.sendMessage(chatId, 'Користувача не знайдено. Будь ласка, почніть з команди /start');
      }
      
      // Формування повідомлення про профіль
      let message = `👤 *Ваш профіль*\n\n`;
      message += `Ім'я: ${user.first_name} ${user.last_name || ''}\n`;
      message += `Телеграм ID: ${user.telegram_id}\n`;
      
      // Перевірка наявності номера телефону
      if (user.phone_number) {
        message += `Телефон: ${user.phone_number}\n`;
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              ['📱 Оновити телефон'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        });
      } else {
        message += `Телефон: Не вказано\n\n`;
        message += `Для повноцінного використання бота, будь ласка, надайте свій номер телефону.`;
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{
                text: '📱 Надати номер телефону',
                request_contact: true
              }],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        });
      }
      
      // Оновлення сесії
      sessionService.update(chatId, { state: 'profile_view' });
    } catch (error) {
      logger.error(`Помилка в обробці профілю: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник додавання номера телефону
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Перевірка, чи належить контакт поточному користувачеві
      if (msg.contact.user_id.toString() !== msg.from.id.toString()) {
        return bot.sendMessage(chatId, 'Будь ласка, надайте свій власний номер телефону.');
      }
      
      // Додавання номера телефону
      const updatedUser = await UserController.addPhoneNumber(
        msg.from.id.toString(), 
        msg.contact.phone_number
      );
      
      if (updatedUser) {
        await bot.sendMessage(chatId, 
          '✅ Дякуємо! Ваш номер телефону успішно збережено.', 
          {
            reply_markup: {
              keyboard: [
                ['🔍 Моніторинг цін'],
                ['🛒 Придбати талони'],
                ['🎫 Мої талони'],
                ['📞 Підтримка', '👤 Мій профіль'],
                ['🤝 Стати партнером']
              ],
              resize_keyboard: true
            }
          }
        );
      }
    } catch (error) {
      logger.error(`Помилка при збереженні номера телефону: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка при збереженні номера телефону.');
    }
  });

  // Обробник оновлення номера телефону
  bot.onText(/📱 Оновити телефон/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await bot.sendMessage(chatId, 
        'Надішліть новий номер телефону, натиснувши на кнопку нижче:', 
        {
          reply_markup: {
            keyboard: [
              [{
                text: '📱 Оновити номер телефону',
                request_contact: true
              }],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
      
      // Оновлення сесії
      sessionService.update(chatId, { state: 'update_phone' });
    } catch (error) {
      logger.error(`Помилка при оновленні номера телефону: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });
};