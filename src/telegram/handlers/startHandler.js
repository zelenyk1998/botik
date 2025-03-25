const UserController = require('../controllers/userController');
const logger = require('../utils/logger');

module.exports = (bot, sessionService) => {
  // Обробник команди /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Формуємо дані користувача з Telegram
      const userData = {
        telegram_id: msg.from.id.toString(),
        username: msg.from.username || null,
        first_name: msg.from.first_name || '',
        last_name: msg.from.last_name || ''
      };
      
      // Створення або оновлення користувача
      let user = await UserController.findUserByTelegramId(userData.telegram_id);
      
      if (!user) {
        // Створення нового користувача
        user = await UserController.createUser(userData);
        logger.info(`Новий користувач створений: ${user.id}`);
      } else {
        // Оновлення існуючого користувача
        user = await UserController.updateUser(userData.telegram_id, {
          username: userData.username,
          first_name: userData.first_name,
          last_name: userData.last_name
        });
        logger.info(`Профіль користувача оновлено: ${user.id}`);
      }
      
      // Створення сесії
      sessionService.create(chatId, { 
        state: 'main_menu',
        userId: user.id 
      });
      
      // Надсилання головного меню
      await bot.sendMessage(chatId, 
        `👋 Вітаємо у чат-боті з продажу талонів на пальне!\n\nВиберіть опцію:`, 
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
    } catch (error) {
      logger.error(`Помилка в обробці команди /start: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });
};