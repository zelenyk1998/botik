const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = (bot, sessionService) => {
  // Обробник кнопки "Підтримка"
  bot.onText(/📞 Підтримка/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Контактна інформація та опції підтримки
      await bot.sendMessage(chatId, 
        `🤝 *Служба підтримки*\n\n` +
        `📱 Телефон: ${config.support.phone}\n` +
        `✉️ Email: ${config.support.email}\n` +
        `⏰ Графік роботи: ${config.support.workHours}\n\n` +
        `Оберіть спосіб зв'язку або отримання додаткової інформації:`, 
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📄 Публічна оферта', callback_data: 'public_offer' },
                { text: '🔒 Політика конфіденційності', callback_data: 'privacy_policy' }
              ],
              [
                { text: '📧 Написати в підтримку', callback_data: 'contact_support' }
              ]
            ]
          }
        }
      );

      // Оновлення сесії
      sessionService.update(chatId, { state: 'support_menu' });
    } catch (error) {
      logger.error(`Помилка в меню підтримки: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник callback-кнопок підтримки
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    
    try {
      switch (query.data) {
        case 'public_offer':
          // Надсилання документу публічної оферти
          await bot.sendDocument(chatId, config.support.offerDocumentPath, {
            caption: 'Публічна оферта'
          });
          break;
        
        case 'privacy_policy':
          // Надсилання документу політики конфіденційності
          await bot.sendDocument(chatId, config.support.privacyDocumentPath, {
            caption: 'Політика конфіденційності'
          });
          break;
        
        case 'contact_support':
          // Підготовка до надсилання повідомлення в підтримку
          await bot.sendMessage(chatId, 
            '✉️ Напишіть ваше питання або проблему. ' +
            'Наш співробітник підтримки зв\'яже з вами найближчим часом.'
          );
          
          // Оновлення сесії для очікування повідомлення
          sessionService.update(chatId, { state: 'support_message' });
          break;
      }

      // Підтвердження отримання callback-запиту
      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      logger.error(`Помилка обробки меню підтримки: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник повідомлень до підтримки
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionService.get(chatId);

    // Перевірка стану сесії
    if (!session || session.state !== 'support_message') {
      return;
    }

    try {
      // Перевірка тексту повідомлення
      if (!msg.text || msg.text.length < 10) {
        return bot.sendMessage(chatId, 
          'Будь ласка, напишіть більш детальне повідомлення (не менше 10 символів).'
        );
      }

      // Формування повідомлення для служби підтримки
      const supportMessage = 
        `🆘 Нове звернення від користувача:\n\n` +
        `ID: ${msg.from.id}\n` +
        `Ім'я: ${msg.from.first_name} ${msg.from.last_name || ''}\n` +
        `Username: @${msg.from.username || 'не вказано'}\n\n` +
        `Повідомлення:\n${msg.text}`;

      // Надсилання повідомлення до групи підтримки або адміністратору
      await bot.sendMessage(config.support.chatId, supportMessage);

      // Підтвердження користувачу
      await bot.sendMessage(chatId, 
        '✅ Ваше повідомлення надіслано службі підтримки. ' +
        'Ми зв\'яжемось з вами найближчим часом.'
      );

      // Повернення до головного меню
      await bot.sendMessage(chatId, 
        'Головне меню:', 
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

      // Скидання сесії
      sessionService.delete(chatId);
    } catch (error) {
      logger.error(`Помилка обробки повідомлення підтримки: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка при надсиланні повідомлення.');
    }
  });

  // Обробник кнопки "Стати партнером"
  bot.onText(/🤝 Стати партнером/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      await bot.sendMessage(chatId, 
        `Щоб стати партнером нашого сервісу, заповніть форму:\n\n` +
        `1. Назва компанії\n` +
        `2. Контактна особа\n` +
        `3. Телефон\n` +
        `4. Email\n` +
        `5. Кількість АЗС\n\n` +
        `Надішліть заповнену інформацію або зв'яжіться:\n` +
        `📧 ${config.support.partnerEmail}\n` +
        `📱 ${config.support.phone}`
      );

      // Оновлення сесії
      sessionService.update(chatId, { state: 'partner_request' });
    } catch (error) {
      logger.error(`Помилка в обробці партнерської заявки: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });
};