// Додайте цей код до bot.js, інтегруючи його з основною логікою

// Імпорт класу AIAssistant
const AIAssistant = require('./aiAssistant');

// Створення екземпляра AIAssistant
const aiAssistant = new AIAssistant();

// Додайте цей код до функції startBot у файлі bot.js
function addAIAssistantHandlers(bot) {
  // Користувачі, які використовують ШІ режим
  const aiChatModes = {};
  
  // Обробник для AI асистента
  bot.onText(/\/ai/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Активуємо режим ШІ для цього користувача
    aiChatModes[chatId] = true;
    
    await bot.sendMessage(
      chatId,
      `🤖 *Режим AI асистента активовано!*\n\nТепер ви можете задавати мені будь-які питання про пальне, АЗС, автомобілі та їх обслуговування.\n\nЩоб вийти з режиму AI асистента, натисніть кнопку "Вимкнути AI асистента" або введіть /exit.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['❌ Вимкнути AI асистента'],
            ['📝 Приклади питань'],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      }
    );
  });
  
  // Обробник для виходу з режиму ШІ
  bot.onText(/❌ Вимкнути AI асистента|\/exit/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Перевіряємо, чи користувач в режимі ШІ
    if (!aiChatModes[chatId]) {
      return;
    }
    
    // Деактивуємо режим ШІ
    delete aiChatModes[chatId];
    
    await bot.sendMessage(
      chatId,
      '🔙 Режим AI асистента вимкнено. Повертаємось до звичайного режиму.',
      {
        reply_markup: {
          keyboard: [
            ['🔍 Моніторинг цін', '🛒 Придбати талони'],
              ['🎫 Мої талони', '🤖 AI асистент'],
              ['📞 Підтримка', '👤 Мій профіль'],
              ['📍 Знайти АЗС'],
              ['🤝 Стати партнером']
          ],
          resize_keyboard: true
        }
      }
    );
  });
  
  // Обробник для прикладів питань
  bot.onText(/📝 Приклади питань/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Перевіряємо, чи користувач в режимі ШІ
    if (!aiChatModes[chatId]) {
      return;
    }
    
    await bot.sendMessage(
      chatId,
      `*Приклади питань для AI асистента:*\n\n` +
      `- Яке пальне краще для зимового періоду?\n` +
      `- Що означає октанове число бензину?\n` +
      `- Чи можна змішувати різні типи пального?\n` +
      `- Як часто потрібно міняти масло в автомобілі?\n` +
      `- Які переваги преміального пального?\n` +
      `- Що робити, якщо залили не те пальне?\n` +
      `- Як економити пальне під час поїздок?\n\n` +
      `Спробуйте задати одне з цих питань або будь-яке інше питання про пальне, авто чи АЗС.`,
      {
        parse_mode: 'Markdown'
      }
    );
  });
  
  // Додаємо кнопку AI асистента до головного меню
  const originalBackToMenuHandler = bot._textRegexpCallbacks.find(
    handler => handler.regexp && handler.regexp.toString().includes('Назад до меню')
  );
  
  if (originalBackToMenuHandler) {
    // Зберігаємо оригінальний обробник
    const originalCallback = originalBackToMenuHandler.callback;
    
    // Замінюємо на новий обробник, який додає кнопку AI асистента
    originalBackToMenuHandler.callback = async (msg, match) => {
      const chatId = msg.chat.id;
      
      // Якщо користувач був у режимі ШІ, вимикаємо його
      if (aiChatModes[chatId]) {
        delete aiChatModes[chatId];
      }
      
      try {
        // Перевіряємо наявність активних талонів у користувача
        const user = await User.findOne({ 
          where: { telegram_id: msg.from.id.toString() } 
        });
        
        if (!user) {
          throw new Error('Користувача не знайдено');
        }
        
        const activeVouchers = await Voucher.findAll({
          where: { 
            owner_id: user.id,
            is_used: false,
            expiration_date: { [Op.gt]: new Date() }
          }
        });
        
        // Базові кнопки меню
        const keyboard = [
          ['🔍 Моніторинг цін', '🛒 Придбати талони'],
              ['🎫 Мої талони', '🤖 AI асистент'],
              ['📞 Підтримка', '👤 Мій профіль'],
              ['📍 Знайти АЗС'],
              ['🤝 Стати партнером']
        ];
        
        // Додаємо кнопку "Знайти АЗС" якщо є активні талони
        if (activeVouchers.length > 0) {
          keyboard.splice(3, 0, ['📍 Знайти АЗС']);
        }
        
        // Показуємо головне меню з можливою додатковою кнопкою
        await bot.sendMessage(chatId, 
          `Головне меню:`, 
          {
            reply_markup: {
              keyboard: keyboard,
              resize_keyboard: true
            }
          }
        );
      } catch (error) {
        console.error('Error displaying main menu:', error);
        
        // Показуємо стандартне меню у випадку помилки
        await bot.sendMessage(chatId, 
          `Головне меню:`, 
          {
            reply_markup: {
              keyboard: [
                ['🔍 Моніторинг цін', '🛒 Придбати талони'],
              ['🎫 Мої талони', '🤖 AI асистент'],
              ['📞 Підтримка', '👤 Мій профіль'],
              ['📍 Знайти АЗС'],
              ['🤝 Стати партнером']
              ],
              resize_keyboard: true
            }
          }
        );
      }
    };
  }

  // Обробник для кнопки AI асистента в головному меню
  bot.onText(/🤖 AI асистент/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Активуємо режим ШІ для цього користувача
    aiChatModes[chatId] = true;
    
    await bot.sendMessage(
      chatId,
      `🤖 *Режим AI асистента активовано!*\n\nТепер ви можете задавати мені будь-які питання про пальне, АЗС, автомобілі та їх обслуговування.\n\nЩоб вийти з режиму AI асистента, натисніть кнопку "Вимкнути AI асистента" або введіть /exit.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['❌ Вимкнути AI асистента'],
            ['📝 Приклади питань'],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      }
    );
  });
  
  // Основний обробник повідомлень для AI асистента
  const originalMessageHandler = bot.on.bind(bot);
  bot.on = function(event, callback) {
    if (event === 'message') {
      return originalMessageHandler(event, async (msg) => {
        const chatId = msg.chat.id;
        
        // Якщо користувач в режимі ШІ і це не команда
        if (aiChatModes[chatId] && 
            msg.text && 
            !msg.text.startsWith('/') && 
            !msg.text.includes('Вимкнути AI асистента') &&
            !msg.text.includes('Приклади питань')) {
            
          try {
            // Показуємо, що бот друкує
            await bot.sendChatAction(chatId, 'typing');
            
            // Отримуємо відповідь від ШІ
            const aiResponse = await aiAssistant.processUkrainianQuery(msg.text);
            
            // Відправляємо відповідь користувачу
            await bot.sendMessage(chatId, aiResponse, {
              parse_mode: 'Markdown',
              reply_markup: {
                keyboard: [
                  ['❌ Вимкнути AI асистента'],
                  ['📝 Приклади питань'],
                  ['🔙 Назад до меню']
                ],
                resize_keyboard: true
              }
            });
            
            return; // Не продовжуємо виконання інших обробників
          } catch (error) {
            console.error('AI assistant error:', error);
            
            // Відправляємо повідомлення про помилку
            await bot.sendMessage(
              chatId,
              `На жаль, виникла помилка при обробці вашого запиту. Спробуйте пізніше або задайте інше питання.`,
              {
                reply_markup: {
                  keyboard: [
                    ['❌ Вимкнути AI асистента'],
                    ['📝 Приклади питань'],
                    ['🔙 Назад до меню']
                  ],
                  resize_keyboard: true
                }
              }
            );
            
            return;
          }
        }
        
        // Виконуємо оригінальний обробник для всіх інших повідомлень
        callback(msg);
      });
    }
    
    return originalMessageHandler(event, callback);
  };
  
  return bot;
}

module.exports = { addAIAssistantHandlers };