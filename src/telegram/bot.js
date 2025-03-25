const TelegramBot = require('node-telegram-bot-api');
const { User, GasStation, FuelType, Price, Voucher, Transaction, GasStationLocation } = require('../models');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { createVoucherQR } = require('./qrGenerator');
const PaymentController = require('../connectors/payments_gateway/paymentController');
const { LocalStorage } = require('node-localstorage');
const { addAIAssistantHandlers } = require('./bot-ai-integration');



let userSessions = {};


// Функція для генерації QR-коду талону
const generateVoucherQR = async (voucher) => {
  try {
    const qrData = voucher.code; // Використовуємо лише сам код

    const qrFolderPath = path.join(__dirname, 'qr_codes');
    if (!fs.existsSync(qrFolderPath)) {
      fs.mkdirSync(qrFolderPath, { recursive: true });
    }

    const qrFilePath = path.join(qrFolderPath, `${voucher.code}.png`);
    await QRCode.toFile(qrFilePath, qrData);

    return qrFilePath;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Радіус Землі в км
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

function toRad(degrees) {
  return degrees * Math.PI / 180;
}




const startBot = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
    return null;
  }
  

  // Create bot instance
  const bot = new TelegramBot(token, { polling: true });

  addAIAssistantHandlers(bot);

  // Handler for /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Extract comprehensive user data from Telegram
      const telegramUser = {
        telegram_id: msg.from.id.toString(),
        username: msg.from.username || null,
        first_name: msg.from.first_name || '',
        last_name: msg.from.last_name || '',
        joined_date: new Date(),
        last_active: new Date()
      };
      
      console.log('Telegram user data:', telegramUser);
      
      // Find or create user in the database
      let user = await User.findOne({ 
        where: { telegram_id: telegramUser.telegram_id } 
      });
      
      if (!user) {
        // Create a new user record
        user = await User.create(telegramUser);
        console.log('New user created:', user.id);
      } else {
        // Update existing user with latest data from Telegram
        await user.update({
          username: telegramUser.username || user.username,
          first_name: telegramUser.first_name || user.first_name,
          last_name: telegramUser.last_name || user.last_name,
          last_active: new Date()
        });
        console.log('User updated:', user.id);
      }
      
      // Send welcome message
      await bot.sendMessage(chatId, 
        `👋 Вітаємо у чат-боті з продажу талонів на пальне!\n\nВиберіть опцію:`, 
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
    } catch (error) {
      console.error('Error in /start command:', error);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Request phone number from user
  // ВИПРАВЛЕНО: змінено регулярний вираз з 📞 на 👤
  bot.onText(/👤 Мій профіль/, async (msg) => {
    const chatId = msg.chat.id;
  
    try {
      console.log("Відкриваємо профіль користувача", msg.from.id);
  
      // Перевіряємо, чи існує користувач
      const user = await User.findOne({ 
        where: { telegram_id: msg.from.id.toString() } 
      });
  
      if (!user) {
        return bot.sendMessage(chatId, '❌ *Користувача не знайдено.*\nБудь ласка, почніть з команди /start.', { parse_mode: 'Markdown' });
      }
  
      let message = `👤 *Ваш профіль*\n\n`;
      message += `🆔 *Telegram ID:* ${user.telegram_id}\n`;
      message += `👨‍💼 *Ім'я:* ${user.first_name || 'Не вказано'} ${user.last_name || ''}\n`;
  
      console.log("Номер телефону користувача:", user.phone_number);
  
      if (user.phone_number) {
        message += `📞 *Телефон:* ${user.phone_number}\n`;
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Оновити телефон', callback_data: 'update_phone' }],
              [{ text: '🔙 Назад до меню', callback_data: 'back_to_menu' }]
            ]
          }
        });
      } else {
        message += `📞 *Телефон:* Не вказано\n\n`;
        message += `⚠️ *Для повноцінного використання бота, будь ласка, надайте свій номер телефону.*`;
        
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
    } catch (error) {
      console.error('❌ Помилка в команді профілю:', error);
      await bot.sendMessage(chatId, '⚠️ Сталася помилка. Спробуйте пізніше.');
    }
  });
  
  // Обробка надсилання номера телефону
  bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
  
    console.log('📞 Отримано контакт:', msg.contact);
  
    try {
      // Перевіряємо, чи номер належить користувачу
      if (msg.contact.user_id.toString() !== msg.from.id.toString()) {
        console.log('⚠️ Контакт не належить поточному користувачу');
        return bot.sendMessage(chatId, '⚠️ Будь ласка, надайте свій власний номер телефону через кнопку "📱 Надати номер телефону".');
      }
  
      console.log('🔄 Оновлюємо номер телефону для користувача з ID:', msg.from.id);
      console.log('📞 Новий номер телефону:', msg.contact.phone_number);
  
      // Оновлюємо номер у базі
      const user = await User.findOne({ where: { telegram_id: msg.from.id.toString() } });
  
      if (user) {
        user.phone_number = msg.contact.phone_number;
        await user.save();
        console.log('✅ Номер телефону оновлено:', user.phone_number);
      } else {
        console.log('❌ Користувача не знайдено');
      }
  
      await bot.sendMessage(chatId, 
        '✅ *Дякуємо!* Ваш номер телефону успішно збережено.', 
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              ['🔍 Моніторинг цін', '🛒 Придбати талони'],
              ['🎫 Мої талони', '🤖 AI асистент'],
              ['📞 Підтримка', '👤 Мій профіль'],
              ['🤝 Стати партнером']
            ],
            resize_keyboard: true
          }
        }
      );
    } catch (error) {
      console.error('❌ Помилка при збереженні номера телефону:', error);
      await bot.sendMessage(chatId, '⚠️ Сталася помилка при збереженні номера телефону. Спробуйте пізніше.');
    }
  });
  
  bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'update_phone') {
      await bot.sendMessage(chatId, '📱 Будь ласка, натисніть кнопку нижче, щоб оновити номер телефону.', {
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
    } else if (data === 'back_to_menu') {
      await bot.sendMessage(chatId, '📍 Ви повернулись у головне меню.', {
        reply_markup: {
          keyboard: [
            ['🔍 Моніторинг цін', '🛒 Придбати талони'],
            ['🎫 Мої талони', '🤖 AI асистент'],
            ['📞 Підтримка', '👤 Мій профіль'],
            ['🤝 Стати партнером']
          ],
          resize_keyboard: true
        }
      });
    }
  } catch (error) {
    console.error('❌ Помилка при обробці callback:', error);
    await bot.sendMessage(chatId, '⚠️ Сталася помилка. Спробуйте пізніше.');
  }
});


  // Handler for "Моніторинг цін" button
bot.onText(/🔍 Моніторинг цін/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Send loading message
    const loadingMessage = await bot.sendMessage(chatId, '⏳ Завантажуємо актуальні ціни...');
    
    // Get all active gas stations
    const gasStations = await GasStation.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
    
    if (gasStations.length === 0) {
      await bot.editMessageText('Наразі немає доступних мереж АЗС.', {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Create an array to hold messages for each station
    // This approach prevents reaching Telegram message size limits
    const stationMessages = [];
    let currentMessage = '📊 <b>Актуальні ціни на пальне</b>\n\n';
    
    // Iterate through each gas station
    for (const station of gasStations) {
      let stationText = `🏢 <b>${station.name}</b>\n`;
      
      // Get prices for this gas station
      const prices = await Price.findAll({
        where: { 
          gas_station_id: station.id,
          is_active: true
        },
        include: [{
          model: FuelType, 
          as: 'fuelType',
          where: { is_active: true }
        }],
        order: [
          [{ model: FuelType, as: 'fuelType' }, 'name', 'ASC'],
          ['amount', 'ASC']
        ]
      });
      
      if (!prices || prices.length === 0) {
        stationText += '   <i>Немає доступних цін</i>\n\n';
        
        // Add this station to the current message
        currentMessage += stationText;
        continue;
      }
      
      // Group prices by fuel type
      const pricesByFuelType = {};
      for (const price of prices) {
        if (!pricesByFuelType[price.fuelType.name]) {
          pricesByFuelType[price.fuelType.name] = [];
        }
        pricesByFuelType[price.fuelType.name].push(price);
      }
      
      // Display prices by fuel type
      for (const [fuelTypeName, fuelPrices] of Object.entries(pricesByFuelType)) {
        stationText += `   🔸 <b>${fuelTypeName}:</b>\n`;
        
        // Table-like format for better readability
        let priceTable = '';
        for (const price of fuelPrices) {
          priceTable += `      • ${price.amount} л — ${price.price.toFixed(2)} грн\n`;
        }
        
        stationText += priceTable;
      }
      
      stationText += '\n';
      
      // Check if adding this station would exceed message size limit
      if ((currentMessage + stationText).length > 3800) {
        // Push current message and start a new one
        stationMessages.push(currentMessage);
        currentMessage = stationText;
      } else {
        // Add this station to the current message
        currentMessage += stationText;
      }
    }
    
    // Add the last message if not empty
    if (currentMessage) {
      stationMessages.push(currentMessage);
    }
    
    // Delete loading message
    await bot.deleteMessage(chatId, loadingMessage.message_id);
    
    // Send all messages
    for (let i = 0; i < stationMessages.length; i++) {
      let message = stationMessages[i];
      
      // Add navigation text to the last message
      if (i === stationMessages.length - 1) {
        message += '\n💡 <i>Для придбання талонів натисніть кнопку "🛒 Придбати талони"</i>';
      }
      
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    }
    
    // Show action buttons after all messages
    await bot.sendMessage(chatId, 'Оберіть наступну дію:', {
      reply_markup: {
        keyboard: [
          ['🛒 Придбати талони'],
          ['🎫 Мої талони'],
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    });
    
  } catch (error) {
    console.error('Error fetching price data:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка при отриманні цін. Спробуйте пізніше.');
  }
});


  // Handler for "Придбати талони" button
  // Handler for "Придбати талони" button
bot.onText(/🛒 Придбати талони/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Show "loading" message
    const loadingMsg = await bot.sendMessage(chatId, '⏳ Завантажуємо доступні мережі АЗС...');
    
    // Store user state
    userSessions[chatId] = { state: 'selecting_gas_station' };
    
    // Get active gas stations
    const gasStations = await GasStation.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']] // Sort by name for better UX
    });
    
    // Delete loading message
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (gasStations.length === 0) {
      return bot.sendMessage(
        chatId, 
        '❌ <b>Наразі немає доступних мереж АЗС.</b>\n\nСпробуйте пізніше або зверніться до служби підтримки.', 
        { parse_mode: 'HTML' }
      );
    }
    
    // Create keyboard with gas stations
    const stationButtons = gasStations.map(station => [`⛽ ${station.name}`]);
    
    const markup = {
      reply_markup: {
        keyboard: [
          ...stationButtons,
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(
      chatId, 
      '🚗 <b>Придбання талонів: Крок 1/4</b>\n\n' +
      'Оберіть мережу АЗС для придбання талонів:', 
      {
        parse_mode: 'HTML',
        ...markup
      }
    );
  } catch (error) {
    console.error('Error in purchase flow:', error);
    await bot.sendMessage(
      chatId, 
      '❌ Сталася помилка при завантаженні мереж АЗС. Спробуйте пізніше.', 
      {
        reply_markup: {
          keyboard: [['🔙 Назад до меню']],
          resize_keyboard: true
        }
      }
    );
  }
});

// Handler for gas station selection
bot.onText(/⛽ (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const stationName = match[1];
  
  // Check if user is in the right state
  if (!userSessions[chatId] || userSessions[chatId].state !== 'selecting_gas_station') {
    return;
  }
  
  try {
    // Show loading message
    const loadingMsg = await bot.sendMessage(chatId, `⏳ Перевіряємо доступні талони для ${stationName}...`);
    
    // Find selected gas station
    const gasStation = await GasStation.findOne({
      where: { name: stationName, is_active: true }
    });
    
    if (!gasStation) {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      return bot.sendMessage(chatId, '❌ Мережу АЗС не знайдено. Спробуйте вибрати іншу.');
    }
    
    // Store selected gas station in session
    userSessions[chatId].gasStation = gasStation.id;
    userSessions[chatId].stationName = gasStation.name;
    userSessions[chatId].state = 'selecting_fuel_type';
    
    // Get available fuel types for the selected gas station
    const availableFuelTypeIds = await Voucher.findAll({
      where: {
        gas_station_id: gasStation.id,
        owner_id: null,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() }
      },
      attributes: ['fuel_type_id'],
      group: ['fuel_type_id'],
      raw: true
    }).then(vouchers => vouchers.map(v => v.fuel_type_id));
    
    // Delete loading message
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (availableFuelTypeIds.length === 0) {
      return bot.sendMessage(
        chatId, 
        `❌ <b>Наразі немає доступних талонів для ${stationName}.</b>\n\nСпробуйте обрати іншу мережу АЗС або завітайте пізніше.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              ['🛒 Придбати талони'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    }
    
    // Get the available fuel types based on available fuel type IDs
    const availableFuelTypes = await FuelType.findAll({
      where: {
        id: { [Op.in]: availableFuelTypeIds },
        is_active: true
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']] // Sort by name
    });
    
    // Generate the keyboard for fuel types
    const fuelTypeButtons = availableFuelTypes.map(type => [`⚡ ${type.name}`]);
    
    const markup = {
      reply_markup: {
        keyboard: [
          ...fuelTypeButtons,
          ['⬅️ Повернутися до вибору АЗС'],
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(
      chatId, 
      `🚗 <b>Придбання талонів: Крок 2/4</b>\n\n` +
      `<b>Обрана мережа:</b> ${gasStation.name}\n\n` +
      `Оберіть вид пального:`, 
      {
        parse_mode: 'HTML',
        ...markup
      }
    );
  } catch (error) {
    console.error('Error in fuel type selection:', error);
    await bot.sendMessage(
      chatId, 
      '❌ Сталася помилка при завантаженні видів пального. Спробуйте пізніше.'
    );
  }
});

// Handler for "Back to gas station selection"
bot.onText(/⬅️ Повернутися до вибору АЗС/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Check if user is in fuel type selection
  if (!userSessions[chatId] || userSessions[chatId].state !== 'selecting_fuel_type') {
    return;
  }
  
  try {
    // Reset session to gas station selection state
    userSessions[chatId].state = 'selecting_gas_station';
    delete userSessions[chatId].gasStation;
    delete userSessions[chatId].stationName;
    
    // Get active gas stations again
    const gasStations = await GasStation.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']]
    });
    
    // Create keyboard with gas stations
    const stationButtons = gasStations.map(station => [`⛽ ${station.name}`]);
    
    const markup = {
      reply_markup: {
        keyboard: [
          ...stationButtons,
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(
      chatId, 
      '🚗 <b>Придбання талонів: Крок 1/4</b>\n\n' +
      'Оберіть мережу АЗС для придбання талонів:', 
      {
        parse_mode: 'HTML',
        ...markup
      }
    );
  } catch (error) {
    console.error('Error returning to gas station selection:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка. Спробуйте пізніше.');
  }
});

// Handler for fuel type selection
bot.onText(/⚡ (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const fuelTypeName = match[1];
  
  // Check if user is in the right state
  if (!userSessions[chatId] || userSessions[chatId].state !== 'selecting_fuel_type') {
    return;
  }
  
  try {
    // Show loading message
    const loadingMsg = await bot.sendMessage(chatId, `⏳ Перевіряємо доступні обсяги для ${fuelTypeName}...`);
    
    // Get fuel type ID based on selected name
    const fuelType = await FuelType.findOne({
      where: {
        name: fuelTypeName,
        is_active: true
      }
    });
    
    if (!fuelType) {
      await bot.deleteMessage(chatId, loadingMsg.message_id);
      return bot.sendMessage(chatId, '❌ Вид пального не знайдено. Спробуйте вибрати інший.');
    }
    
    // Store selected fuel type in session
    userSessions[chatId].fuelType = fuelType.id;
    userSessions[chatId].fuelTypeName = fuelType.name;
    userSessions[chatId].state = 'selecting_amount';
    
    // Get available amounts (vouchers) for the selected fuel type
    const availableAmounts = await Voucher.findAll({
      where: {
        gas_station_id: userSessions[chatId].gasStation,
        fuel_type_id: fuelType.id,
        owner_id: null,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() }
      },
      attributes: ['amount'],
      raw: true
    }).then(vouchers => [...new Set(vouchers.map(v => v.amount))]
      .sort((a, b) => a - b)); // Sort amounts numerically
    
    // Delete loading message
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (availableAmounts.length === 0) {
      return bot.sendMessage(
        chatId, 
        `❌ <b>Наразі немає доступних талонів для ${fuelTypeName}.</b>\n\nСпробуйте обрати інший вид пального.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              ['⬅️ Повернутися до вибору пального'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    }
    
    // Create the markup for the available amounts
    const amountButtons = availableAmounts.map(amount => [`🔢 ${amount} л`]);
    
    const markup = {
      reply_markup: {
        keyboard: [
          ...amountButtons,
          ['⬅️ Повернутися до вибору пального'],
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(
      chatId, 
      `🚗 <b>Придбання талонів: Крок 3/4</b>\n\n` +
      `<b>Обрана мережа:</b> ${userSessions[chatId].stationName}\n` +
      `<b>Обране пальне:</b> ${fuelType.name}\n\n` +
      `Оберіть кількість літрів:`, 
      {
        parse_mode: 'HTML',
        ...markup
      }
    );
  } catch (error) {
    console.error('Error in amount selection:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка при завантаженні обсягів. Спробуйте пізніше.');
  }
});

// Handler for "Back to fuel type selection"
bot.onText(/⬅️ Повернутися до вибору пального/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Check if user is in amount selection state
  if (!userSessions[chatId] || 
     (userSessions[chatId].state !== 'selecting_amount' && 
      userSessions[chatId].state !== 'entering_quantity')) {
    return;
  }
  
  try {
    // Reset session to fuel type selection state
    userSessions[chatId].state = 'selecting_fuel_type';
    delete userSessions[chatId].fuelType;
    delete userSessions[chatId].fuelTypeName;
    delete userSessions[chatId].amount;
    delete userSessions[chatId].availableVouchers;
    
    // Get available fuel types again for the selected gas station
    const availableFuelTypeIds = await Voucher.findAll({
      where: {
        gas_station_id: userSessions[chatId].gasStation,
        owner_id: null,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() }
      },
      attributes: ['fuel_type_id'],
      group: ['fuel_type_id'],
      raw: true
    }).then(vouchers => vouchers.map(v => v.fuel_type_id));
    
    // Get the available fuel types based on available fuel type IDs
    const availableFuelTypes = await FuelType.findAll({
      where: {
        id: { [Op.in]: availableFuelTypeIds },
        is_active: true
      },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    
    // Generate the keyboard for fuel types
    const fuelTypeButtons = availableFuelTypes.map(type => [`⚡ ${type.name}`]);
    
    const markup = {
      reply_markup: {
        keyboard: [
          ...fuelTypeButtons,
          ['⬅️ Повернутися до вибору АЗС'],
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(
      chatId, 
      `🚗 <b>Придбання талонів: Крок 2/4</b>\n\n` +
      `<b>Обрана мережа:</b> ${userSessions[chatId].stationName}\n\n` +
      `Оберіть вид пального:`, 
      {
        parse_mode: 'HTML',
        ...markup
      }
    );
  } catch (error) {
    console.error('Error returning to fuel type selection:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка. Спробуйте пізніше.');
  }
});

// Handler for amount selection
bot.onText(/🔢 (\d+) л/, async (msg, match) => {
  const chatId = msg.chat.id;
  const amount = parseInt(match[1]);
  
  // Check if user is in the right state
  if (!userSessions[chatId] || userSessions[chatId].state !== 'selecting_amount') {
    return;
  }
  
  try {
    // Show loading message
    const loadingMsg = await bot.sendMessage(chatId, `⏳ Перевіряємо наявність талонів...`);
    
    // Store selected amount in session
    userSessions[chatId].amount = amount;
    userSessions[chatId].state = 'entering_quantity';
    
    // Find available vouchers in the database
    const availableVouchers = await Voucher.findAll({
      where: {
        gas_station_id: userSessions[chatId].gasStation,
        fuel_type_id: userSessions[chatId].fuelType,
        amount: amount,
        owner_id: null,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() }
      },
      include: [
        { model: GasStation, as: 'gasStation' },
        { model: FuelType, as: 'fuelType' }
      ],
      order: [['expiration_date', 'ASC']] // Get earliest expiration first
    });
    
    // Delete loading message
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    
    if (availableVouchers.length === 0) {
      return bot.sendMessage(
        chatId, 
        `❌ <b>На жаль, зараз немає доступних талонів на ${amount}л.</b>\n\nСпробуйте обрати інший обсяг.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [
              ['⬅️ Повернутися до вибору обсягу'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    }
    
    // Get voucher info
    const sampleVoucher = availableVouchers[0];
    const expirationDate = new Date(sampleVoucher.expiration_date);
    const formattedDate = expirationDate.toLocaleDateString('uk-UA');
    const maxQuantity = Math.min(availableVouchers.length, 20);
    
    // Store vouchers in session for later use
    userSessions[chatId].availableVouchers = availableVouchers;
    userSessions[chatId].pricePerVoucher = sampleVoucher.purchase_price;
    
    // Create a clean summary message
    let message = `🚗 <b>Придбання талонів: Крок 4/4</b>\n\n`;
    message += `<b>Ви обрали:</b>\n`;
    message += `⛽ <b>Мережа:</b> ${userSessions[chatId].stationName}\n`;
    message += `⚡ <b>Пальне:</b> ${userSessions[chatId].fuelTypeName}\n`;
    message += `🔢 <b>Обсяг:</b> ${amount} л\n`;
    message += `💰 <b>Ціна:</b> ${sampleVoucher.purchase_price.toFixed(2)} грн за талон\n`;
    message += `📅 <b>Термін дії:</b> до ${formattedDate}\n\n`;
    message += `🎫 <b>Доступно талонів:</b> ${availableVouchers.length}\n\n`;
    message += `<b>Введіть бажану кількість талонів</b> (від 1 до ${maxQuantity}):`;
    
    // Add number keyboard suggestions
    const numKeyboard = [];
    const row1 = [];
    const row2 = [];
    
    // Create number buttons based on available quantity
    for (let i = 1; i <= Math.min(maxQuantity, 5); i++) {
      row1.push({ text: i.toString() });
    }
    
    if (maxQuantity > 5) {
      for (let i = 6; i <= Math.min(maxQuantity, 10); i++) {
        row2.push({ text: i.toString() });
      }
    }
    
    if (row1.length > 0) numKeyboard.push(row1);
    if (row2.length > 0) numKeyboard.push(row2);
    
    numKeyboard.push([{ text: '⬅️ Повернутися до вибору обсягу' }]);
    numKeyboard.push([{ text: '🔙 Назад до меню' }]);
    
    const markup = {
      reply_markup: {
        keyboard: numKeyboard,
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...markup
    });
  } catch (error) {
    console.error('Error showing voucher options:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка при перевірці талонів. Спробуйте пізніше.');
  }
});

// Handler for "Back to amount selection"
bot.onText(/⬅️ Повернутися до вибору обсягу/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Check if user is in quantity entry state
  if (!userSessions[chatId] || 
     (userSessions[chatId].state !== 'entering_quantity' && 
      userSessions[chatId].state !== 'confirming_purchase')) {
    return;
  }
  
  try {
    // Reset session to amount selection state
    userSessions[chatId].state = 'selecting_amount';
    delete userSessions[chatId].amount;
    delete userSessions[chatId].availableVouchers;
    delete userSessions[chatId].pricePerVoucher;
    
    // Get available amounts again
    const availableAmounts = await Voucher.findAll({
      where: {
        gas_station_id: userSessions[chatId].gasStation,
        fuel_type_id: userSessions[chatId].fuelType,
        owner_id: null,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() }
      },
      attributes: ['amount'],
      raw: true
    }).then(vouchers => [...new Set(vouchers.map(v => v.amount))]
      .sort((a, b) => a - b));
    
    // Create the markup for the available amounts
    const amountButtons = availableAmounts.map(amount => [`🔢 ${amount} л`]);
    
    const markup = {
      reply_markup: {
        keyboard: [
          ...amountButtons,
          ['⬅️ Повернутися до вибору пального'],
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(
      chatId, 
      `🚗 <b>Придбання талонів: Крок 3/4</b>\n\n` +
      `<b>Обрана мережа:</b> ${userSessions[chatId].stationName}\n` +
      `<b>Обране пальне:</b> ${userSessions[chatId].fuelTypeName}\n\n` +
      `Оберіть кількість літрів:`, 
      {
        parse_mode: 'HTML',
        ...markup
      }
    );
  } catch (error) {
    console.error('Error returning to amount selection:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка. Спробуйте пізніше.');
  }
});

// Handler for manual quantity input
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Update last_active for any message
  try {
    await User.update(
      { last_active: new Date() },
      { where: { telegram_id: msg.from.id.toString() } }
    );
  } catch (error) {
    console.error('Error updating user last_active:', error);
  }
  
  // Check if user is in the quantity entry state
  if (!userSessions[chatId] || userSessions[chatId].state !== 'entering_quantity') {
    return;
  }
  
  // Skip handling of non-numeric inputs and commands
  if (!text || text.startsWith('/') || text.startsWith('🔙') || 
      text.startsWith('⬅️') || isNaN(text)) {
    return;
  }
  
  try {
    const quantity = parseInt(text);
    const availableVouchers = userSessions[chatId].availableVouchers;
    const maxQuantity = Math.min(availableVouchers.length, 20);
    
    // Validate quantity
    if (quantity <= 0 || quantity > maxQuantity) {
      return bot.sendMessage(
        chatId, 
        `⚠️ <b>Некоректна кількість.</b>\n\nБудь ласка, введіть число від 1 до ${maxQuantity}:`,
        { parse_mode: 'HTML' }
      );
    }
    
    // Update session with quantity
    userSessions[chatId].quantity = quantity;
    userSessions[chatId].state = 'confirming_purchase';
    
    // Calculate total price
    const totalPrice = quantity * userSessions[chatId].pricePerVoucher;
    
    // Select vouchers for purchase
    const selectedVouchers = availableVouchers.slice(0, quantity);
    userSessions[chatId].selectedVouchers = selectedVouchers;
    
    // Format the order confirmation message
    let message = `🛒 <b>Підтвердження замовлення</b>\n\n`;
    message += `⛽ <b>Мережа:</b> ${userSessions[chatId].stationName}\n`;
    message += `⚡ <b>Пальне:</b> ${userSessions[chatId].fuelTypeName}\n`;
    message += `🔢 <b>Обсяг:</b> ${userSessions[chatId].amount} л\n`;
    message += `📦 <b>Кількість талонів:</b> ${quantity} шт\n`;
    message += `💰 <b>Ціна за талон:</b> ${userSessions[chatId].pricePerVoucher.toFixed(2)} грн\n`;
    message += `💳 <b>Загальна сума:</b> ${totalPrice.toFixed(2)} грн\n\n`;
    
    // Add expiration dates information
    if (selectedVouchers.length > 0) {
      const earliestExpiration = new Date(selectedVouchers[0].expiration_date);
      message += `📅 <b>Термін дії:</b> до ${earliestExpiration.toLocaleDateString('uk-UA')}\n\n`;
    }
    
    message += `<b>Для завершення придбання натисніть кнопку "Підтвердити покупку"</b>`;
    
    const markup = {
      reply_markup: {
        keyboard: [
          ['✅ Підтвердити покупку'],
          ['❌ Скасувати замовлення'],
          ['⬅️ Змінити кількість талонів']
        ],
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...markup
    });
  } catch (error) {
    console.error('Error processing quantity input:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка під час обробки замовлення. Спробуйте пізніше.');
  }
});

// Handler for "Змінити кількість талонів"
bot.onText(/⬅️ Змінити кількість талонів/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Check if user is in confirming purchase state
  if (!userSessions[chatId] || userSessions[chatId].state !== 'confirming_purchase') {
    return;
  }
  
  try {
    // Change state back to entering quantity
    userSessions[chatId].state = 'entering_quantity';
    delete userSessions[chatId].quantity;
    delete userSessions[chatId].selectedVouchers;
    
    // Get voucher info
    const availableVouchers = userSessions[chatId].availableVouchers;
    const sampleVoucher = availableVouchers[0];
    const amount = userSessions[chatId].amount;
    const expirationDate = new Date(sampleVoucher.expiration_date);
    const formattedDate = expirationDate.toLocaleDateString('uk-UA');
    const maxQuantity = Math.min(availableVouchers.length, 20);
    
    // Create a clean summary message
    let message = `🚗 <b>Придбання талонів: Крок 4/4</b>\n\n`;
    message += `<b>Ви обрали:</b>\n`;
    message += `⛽ <b>Мережа:</b> ${userSessions[chatId].stationName}\n`;
    message += `⚡ <b>Пальне:</b> ${userSessions[chatId].fuelTypeName}\n`;
    message += `🔢 <b>Обсяг:</b> ${amount} л\n`;
    message += `💰 <b>Ціна:</b> ${sampleVoucher.purchase_price.toFixed(2)} грн за талон\n`;
    message += `📅 <b>Термін дії:</b> до ${formattedDate}\n\n`;
    message += `🎫 <b>Доступно талонів:</b> ${availableVouchers.length}\n\n`;
    message += `<b>Введіть бажану кількість талонів</b> (від 1 до ${maxQuantity}):`;
    
    // Add number keyboard suggestions
    const numKeyboard = [];
    const row1 = [];
    const row2 = [];
    
    for (let i = 1; i <= Math.min(maxQuantity, 5); i++) {
      row1.push({ text: i.toString() });
    }
    
    if (maxQuantity > 5) {
      for (let i = 6; i <= Math.min(maxQuantity, 10); i++) {
        row2.push({ text: i.toString() });
      }
    }
    
    if (row1.length > 0) numKeyboard.push(row1);
    if (row2.length > 0) numKeyboard.push(row2);
    
    numKeyboard.push([{ text: '⬅️ Повернутися до вибору обсягу' }]);
    numKeyboard.push([{ text: '🔙 Назад до меню' }]);
    
    const markup = {
      reply_markup: {
        keyboard: numKeyboard,
        resize_keyboard: true
      }
    };
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...markup
    });
  } catch (error) {
    console.error('Error returning to quantity selection:', error);
    await bot.sendMessage(chatId, '❌ Сталася помилка. Спробуйте пізніше.');
  }
});

 // Handler for "Мої талони" button
 bot.onText(/🎫 Мої талони/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const user = await findUser(msg.from.id);
    if (!user) return sendUserNotFoundMessage(chatId);

    const userVouchers = await getUserVouchers(user.id);
    if (!userVouchers.length) return bot.sendMessage(chatId, 'У вас ще немає придбаних талонів.');

    await bot.sendMessage(chatId, 'Виберіть категорію талонів:', getVouchersKeyboard());
  } catch (error) {
    handleError(chatId, error, 'Помилка при відображенні талонів');
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'active_vouchers' || data === 'used_vouchers') {
      await handleVouchersList(chatId, query.from.id, data === 'used_vouchers');
    } else if (data.startsWith('recharge_voucher_')) {
      await handleVoucherRecharge(chatId, data.split('_')[2]);
    }
  } catch (error) {
    handleError(chatId, error, 'Сталася помилка при обробці запиту.');
  }
});

// Допоміжні функції
async function findUser(telegramId) {
  return User.findOne({ where: { telegram_id: telegramId.toString() } });
}

async function getUserVouchers(userId) {
  return Voucher.findAll({
    where: { owner_id: userId },
    include: [
      { model: GasStation, as: 'gasStation' },
      { model: FuelType, as: 'fuelType' }
    ]
  });
}

function sendUserNotFoundMessage(chatId) {
  return bot.sendMessage(chatId, 'Користувача не знайдено. Будь ласка, почніть з команди /start');
}

function getVoucherKeyboard(voucher) {
  return {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        voucher.is_used || new Date(voucher.expiration_date) < new Date()
          ? [{ text: '♻️ Заправити ще раз', callback_data: `recharge_voucher_${voucher.id}` }]
          : [{ text: '⛽ Використати талон', callback_data: `fuel_${voucher.id}` }]
      ]
    }
  };
}

async function handleVouchersList(chatId, userId, isUsed) {
  const user = await findUser(userId);
  if (!user) return sendUserNotFoundMessage(chatId);

  const userVouchers = await getUserVouchers(user.id);
  const filteredVouchers = userVouchers.filter(v => v.is_used === isUsed);
  if (!filteredVouchers.length) {
    return bot.sendMessage(chatId, `У вас немає ${isUsed ? 'використаних' : 'активних'} талонів.`);
  }

  for (const voucher of filteredVouchers) {
    await bot.sendMessage(chatId, formatVoucherMessage(voucher), getVoucherKeyboard(voucher));
  }
}

function formatVoucherMessage(voucher) {
  const statusIcon = voucher.is_used ? '❌' : new Date(voucher.expiration_date) < new Date() ? '⚠️' : '✅';
  const statusText = voucher.is_used ? 'Використаний' : new Date(voucher.expiration_date) < new Date() ? 'Прострочений' : 'Активний';
  
  return `🎫 *Талон: ${voucher.code}*\n` +
         `⛽ *Мережа:* ${voucher.gasStation.name}\n` +
         `⛽ *Пальне:* ${voucher.fuelType.name}\n` +
         `💧 *Обсяг:* ${voucher.amount} л\n` +
         `📅 *Дійсний до:* ${new Date(voucher.expiration_date).toLocaleDateString('uk-UA')}\n` +
         `${statusIcon} *Статус:* ${statusText}\n` +
         (voucher.is_used && voucher.used_at ? `📆 *Використано:* ${new Date(voucher.used_at).toLocaleDateString('uk-UA')}\n` : '');
}

function getVouchersKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Активні талони', callback_data: 'active_vouchers' },
          { text: '📋 Використані', callback_data: 'used_vouchers' }
        ],
        [{ text: '🔙 Назад до меню', callback_data: 'back_to_menu' }]
      ]
    }
  };
}

async function handleVoucherRecharge(chatId, voucherId) {
  const voucher = await Voucher.findOne({
    where: { id: voucherId },
    include: ['gasStation', 'fuelType']
  });

  if (!voucher) return bot.sendMessage(chatId, '❌ Талон не знайдено.');

  try {
    const qrPath = await generateVoucherQR(voucher);
    await bot.sendPhoto(chatId, qrPath, {
      caption: formatVoucherMessage(voucher)
    });

    setTimeout(() => fs.existsSync(qrPath) && fs.unlinkSync(qrPath), 10000);
  } catch (error) {
    handleError(chatId, error, 'Сталася помилка при генерації QR-коду.');
  }
}

function handleError(chatId, error, message) {
  console.error(message, error);
  bot.sendMessage(chatId, message);
}

  // Обробка натискання на кнопку "Заправити"
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data.split('_'); 
  const action = data[0]; 
  const voucherId = data[1]; 

  await bot.answerCallbackQuery(query.id);

  if (action === 'fuel') {
    // Запитуємо підтвердження перед заправкою
    await bot.sendMessage(chatId, 
      `❗ *Ви точно хочете заправитись?*\n\n*Якщо ви натискаєте "Так", то талон буде позначено як використаний!*`, 
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Так', callback_data: `confirm_${voucherId}` }],
            [{ text: '❌ Ні', callback_data: 'cancel' }]
          ]
        }
      }
    );
  } else if (action === 'confirm') {
    try {
      // Знаходимо талон у базі даних
      const voucher = await Voucher.findByPk(voucherId, {
        include: [
          { model: GasStation, as: 'gasStation' },
          { model: FuelType, as: 'fuelType' }
        ]
      });
      
      if (!voucher) {
        return bot.sendMessage(chatId, '❌ Талон не знайдено.');
      }
      
      // Генеруємо QR-код для талону
      const qrPath = await generateVoucherQR(voucher);
      
      // Відправляємо QR-код користувачу
      await bot.sendPhoto(chatId, qrPath, {
        caption: `✅ Ваш QR-код для талона:\n\n` +
                 `🎫 Код: ${voucher.code}\n` +
                 `⛽ Мережа: ${voucher.gasStation.name}\n` +
                 `⚡ Пальне: ${voucher.fuelType.name}\n` +
                 `🔢 Кількість: ${voucher.amount} л\n` +
                 `📅 Дійсний до: ${new Date(voucher.expiration_date).toLocaleDateString('uk-UA')}`
      });
      
      // Позначаємо талон як використаний
      await voucher.update({
        is_used: true,
        used_at: new Date()
      });
      
      // Видаляємо файл QR-коду через 10 секунд
      setTimeout(() => {
        if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);
      }, 10000);
    } catch (error) {
      console.error('Помилка при генерації QR-коду:', error);
      await bot.sendMessage(chatId, '❌ Не вдалося створити QR-код. Спробуйте ще раз.');
    }
  } else if (action === 'cancel') {
    // Користувач натиснув "Ні", просто закриваємо діалог
    await bot.sendMessage(chatId, '❌ Заправку скасовано.');
  }
});

// Handler for "Назад до меню" button
bot.onText(/🔙 Назад до меню/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Reset user session
  delete userSessions[chatId];
  
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
              ['🤝 Стати партнером']
          ],
          resize_keyboard: true
        }
      }
    );
  }
});
// Обробник для отримання геолокації користувача
bot.on('location', async (msg) => {
  const chatId = msg.chat.id;
  
  // Перевіряємо, що ми очікуємо геолокацію
  if (!userSessions[chatId] || userSessions[chatId].state !== 'awaiting_location') {
    return;
  }
  
  try {
    const { latitude, longitude } = msg.location;
    const gasStationId = userSessions[chatId].gasStationId;
    const gasStationName = userSessions[chatId].gasStationName;
    
    await bot.sendMessage(chatId, `🔍 Шукаємо найближчі АЗС мережі ${gasStationName}...`);
    
    // Отримуємо координати всіх АЗС вибраної мережі
    const gasStationLocations = await GasStationLocation.findAll({
      where: { 
        gas_station_id: gasStationId,
        is_active: true 
      }
    });
    
    if (gasStationLocations.length === 0) {
      return bot.sendMessage(chatId, `На жаль, у нас немає даних про розташування АЗС мережі ${gasStationName}.`);
    }
    
    // Розрахувати відстань до кожної АЗС і відсортувати
    const stationsWithDistance = gasStationLocations.map(station => {
      const distance = calculateDistance(latitude, longitude, station.latitude, station.longitude);
      return { 
        ...station.toJSON(), 
        distance 
      };
    }).sort((a, b) => a.distance - b.distance);
    
    // Показати максимум 5 найближчих АЗС
    const nearestStations = stationsWithDistance.slice(0, 5);
    
    // Якщо найближчих АЗС не знайдено
    if (nearestStations.length === 0) {
      return bot.sendMessage(chatId, `На жаль, не знайдено жодної АЗС мережі ${gasStationName} поблизу.`);
    }
    
    // Формуємо повідомлення з найближчими АЗС
    let message = `📍 *Найближчі АЗС ${gasStationName}:*\n\n`;
    
    for (const station of nearestStations) {
      message += `🏪 *${station.name}*\n`;
      message += `📌 Адреса: ${station.address}\n`;
      message += `🚗 Відстань: ${station.distance.toFixed(1)} км\n`;
      
      // Додаємо години роботи, якщо вони є
      if (station.working_hours) {
        message += `⏰ Години роботи: ${station.working_hours}\n`;
      }
      
      // Додаємо доступні послуги, якщо вони є
      if (station.services && Object.keys(station.services).length > 0) {
        message += `🛎️ Послуги: `;
        const servicesList = [];
        
        if (station.services.hasRestaurant) servicesList.push('Ресторан');
        if (station.services.hasShop) servicesList.push('Магазин');
        if (station.services.hasCarWash) servicesList.push('Автомийка');
        if (station.services.hasTireInflation) servicesList.push('Підкачка шин');
        if (station.services.hasElectricCharging) servicesList.push('Електрозарядка');
        
        message += servicesList.join(', ') + '\n';
      }
      
      message += '\n';
    }
    
    // Додаткові дії для найближчої АЗС
    const nearestStation = nearestStations[0];
    
    // Показуємо результати користувачу
    await bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          // Додаємо кнопку для відкриття карти з найближчою АЗС
          [{ text: "🗺️ Показати на карті найближчу АЗС", url: `https://www.google.com/maps/search/${encodeURIComponent(nearestStation.address)}/@${latitude},${longitude},13z` }],
          // Додаємо кнопку для побудови маршруту до найближчої АЗС
          [{ text: "🧭 Маршрут до найближчої АЗС", url: `https://www.google.com/maps/dir/${latitude},${longitude}/${encodeURIComponent(nearestStation.address)}` }]
        ]
      }
    });
    
    // Повертаємося до головного меню
    await bot.sendMessage(chatId, "Виберіть дію:", {
      reply_markup: {
        keyboard: [
          ['🎫 Мої талони'],
          ['📍 Знайти АЗС'],
          ['🔙 Назад до меню']
        ],
        resize_keyboard: true
      }
    });

    
    
    // Очищаємо стан
    delete userSessions[chatId];
  } catch (error) {
    console.error('Error processing location:', error);
    await bot.sendMessage(chatId, 'Сталася помилка при пошуку найближчих АЗС. Спробуйте пізніше.');
  }
});

bot.onText(/📍 Знайти АЗС/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Отримуємо користувача
    const user = await User.findOne({ 
      where: { telegram_id: msg.from.id.toString() } 
    });
    
    if (!user) {
      return bot.sendMessage(chatId, 'Користувача не знайдено. Будь ласка, почніть з команди /start');
    }
    
    // Отримуємо активні талони користувача
    const activeVouchers = await Voucher.findAll({
      where: { 
        owner_id: user.id,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() }
      },
      include: [
        { model: GasStation, as: 'gasStation' }
      ]
    });
    
    if (activeVouchers.length === 0) {
      return bot.sendMessage(chatId, 'У вас немає активних талонів. Спочатку придбайте талони для пошуку АЗС.', {
        reply_markup: {
          keyboard: [
            ['🛒 Придбати талони'],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      });
    }
    
    // Рахуємо унікальні мережі АЗС для талонів користувача
    const uniqueStations = [...new Set(activeVouchers.map(v => v.gasStation.id))];
    
    // Якщо є талони тільки однієї мережі, відразу показуємо АЗС цієї мережі
    if (uniqueStations.length === 1) {
      const stationId = uniqueStations[0];
      const stationName = activeVouchers[0].gasStation.name;
      
      // Запитуємо в користувача геолокацію для пошуку найближчих АЗС
      await bot.sendMessage(chatId, 
        `Для пошуку найближчих АЗС мережі ${stationName}, поділіться вашим місцезнаходженням:`, 
        {
          reply_markup: {
            keyboard: [
              [{
                text: '📍 Поділитися місцезнаходженням',
                request_location: true
              }],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
      
      // Зберігаємо стан для обробки геолокації
      userSessions[chatId] = { 
        state: 'awaiting_location',
        gasStationId: stationId,
        gasStationName: stationName
      };
    } else {
      // Якщо є талони декількох мереж, даємо вибрати мережу АЗС
      const stationButtons = [];
      
      // Отримуємо унікальні мережі АЗС
      const gasStations = await GasStation.findAll({
        where: { 
          id: { [Op.in]: uniqueStations },
          is_active: true
        }
      });
      
      for (const station of gasStations) {
        stationButtons.push([`🔍 ${station.name}`]);
      }
      
      await bot.sendMessage(chatId, 
        'У вас є талони різних мереж АЗС. Виберіть, яку мережу АЗС шукати:', 
        {
          reply_markup: {
            keyboard: [
              ...stationButtons,
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
      
      // Зберігаємо стан для обробки вибору мережі
      userSessions[chatId] = { state: 'selecting_gas_station_for_location' };
    }
  } catch (error) {
    console.error('Error searching for gas stations:', error);
    await bot.sendMessage(chatId, 'Сталася помилка при пошуку АЗС. Спробуйте пізніше.');
  }
});

// Обробник для вибору мережі АЗС для пошуку
bot.onText(/🔍 (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const stationName = match[1];
  
  // Перевіряємо, що користувач вибирає мережу АЗС для пошуку
  if (!userSessions[chatId] || userSessions[chatId].state !== 'selecting_gas_station_for_location') {
    return;
  }
  
  try {
    // Отримуємо ID мережі АЗС
    const gasStation = await GasStation.findOne({
      where: { name: stationName, is_active: true }
    });
    
    if (!gasStation) {
      return bot.sendMessage(chatId, 'Мережу АЗС не знайдено.');
    }
    
    // Запитуємо в користувача геолокацію для пошуку найближчих АЗС
    await bot.sendMessage(chatId, 
      `Для пошуку найближчих АЗС мережі ${stationName}, поділіться вашим місцезнаходженням:`, 
      {
        reply_markup: {
          keyboard: [
            [{
              text: '📍 Поділитися місцезнаходженням',
              request_location: true
            }],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      }
    );
    
    // Зберігаємо стан для обробки геолокації
    userSessions[chatId] = { 
      state: 'awaiting_location',
      gasStationId: gasStation.id,
      gasStationName: gasStation.name
    };
  } catch (error) {
    console.error('Error selecting gas station for location:', error);
    await bot.sendMessage(chatId, 'Сталася помилка при виборі мережі АЗС. Спробуйте пізніше.');
  }
});

// Handler for confirming the purchase
bot.onText(/✅ Підтвердити покупку/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Check if user is in the right state
  if (!userSessions[chatId] || userSessions[chatId].state !== 'confirming_purchase' || !userSessions[chatId].selectedVouchers) {
    return;
  }
  
  try {
    const user = await User.findOne({
      where: { telegram_id: msg.from.id.toString() }
    });
    
    if (!user) {
      return bot.sendMessage(chatId, 'Користувача не знайдено. Будь ласка, почніть з команди /start');
    }
    
    // Check if user has a phone number
    if (!user.phone_number) {
      return bot.sendMessage(
        chatId, 
        'Для здійснення оплати необхідно вказати номер телефону. Будь ласка, перейдіть до свого профілю та додайте номер телефону.',
        {
          reply_markup: {
            keyboard: [
              ['👤 Мій профіль'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    }
    
    const selectedVouchers = userSessions[chatId].selectedVouchers;
    
    // Send "processing" message
    const processingMsg = await bot.sendMessage(
      chatId, 
      '⏳ Створюємо замовлення та підготовлюємо оплату...'
    );
    
    try {
  // Create payment controller
  

  const paymentController = new PaymentController()
  
  // Calculate total price
  const totalAmount = selectedVouchers.reduce((sum, v) => sum + v.purchase_price, 0);

  // const verifyPhone = user.phone_number.startsWith("+")


  
  // Create transaction
  const result = await paymentController.createTransaction(
    user.id,                    // userId замість об'єкту з totalAmount
    selectedVouchers,           // vouchers як другий параметр
    `+${user.phone_number}`           // phoneNumber як третій параметр
  );

      
      // Check if we have a payment URL
      if (!result || !result.payment_url) {
        throw new Error('Не вдалося створити посилання для оплати');
      }
      
      // Store transaction details in session
      userSessions[chatId].transactionId = result.transaction_id;
      
      // Edit processing message to show payment link
      await bot.editMessageText(
        `💳 Замовлення успішно створено!\n\n` +
        `⛽ Мережа: ${userSessions[chatId].stationName}\n` +
        `⚡ Пальне: ${userSessions[chatId].fuelTypeName}\n` +
        `🔢 Кількість: ${userSessions[chatId].amount} л\n` +
        `📦 Кількість талонів: ${selectedVouchers.length} шт\n` +
        `💰 Загальна сума: ${totalAmount} грн\n\n` +
        `Для завершення оплати перейдіть за посиланням:`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id
        }
      );
      
      // Send payment URL as a separate message with inline keyboard
      await bot.sendMessage(
        chatId,
        `🔗 [Оплатити замовлення](${result.payment_url})`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Перейти до оплати', url: result.payment_url }]
            ]
          }
        }
      );
      
      // Send follow-up message with instructions
      await bot.sendMessage(
        chatId,
        'Після успішної оплати ви отримаєте талони в розділі "🎫 Мої талони" протягом 1 хвилини.\n' +
        'Статус замовлення можна перевірити командою: /status',
        {
          reply_markup: {
            keyboard: [
              ['🎫 Мої талони'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
      
      // Don't reset the session yet, keep it for status checks
      userSessions[chatId].state = 'awaiting_payment';
      const localStorage = new LocalStorage('./scratch');

      localStorage.setItem("transaction_id", result.transaction_id)
      
    } catch (error) {
      console.error('Payment creation error:', error);
      
      // Determine error type for better user feedback
      let errorMessage = 'Виникла помилка при створенні платежу. ';
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorMessage += 'Сервіс оплати тимчасово недоступний. Будь ласка, спробуйте пізніше.';
      } else if (error.response && error.response.status === 400) {
        errorMessage += 'Неправильні дані для оплати. Перевірте номер телефону та спробуйте знову.';
      } else if (error.response && error.response.status === 401) {
        errorMessage += 'Помилка авторизації в платіжному сервісі. Зверніться до служби підтримки.';
      } else {
        errorMessage += 'Спробуйте ще раз або зверніться до служби підтримки.';
      }
      
      // Edit processing message to show error
      await bot.editMessageText(
        `❌ ${errorMessage}`,
        {
          chat_id: chatId,
          message_id: processingMsg.message_id
        }
      );
      
      // Offer to try again or contact support
      await bot.sendMessage(
        chatId,
        'Ви можете спробувати знову або звернутися до служби підтримки.',
        {
          reply_markup: {
            keyboard: [
              ['🛒 Придбати талони'],
              ['📞 Підтримка'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    }
  } catch (error) {
    console.error('Error during purchase confirmation:', error);
    await bot.sendMessage(
      chatId, 
      'Сталася помилка при оформленні замовлення. Спробуйте пізніше або зверніться до підтримки.'
    );
  }
});

// Add a command to check transaction status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  
  // Check if user has a pending transaction
  if (!chatId) {
    return bot.sendMessage(chatId, 'У вас немає активних замовлень для перевірки статусу.');
  }
  
  try {
    // Send "checking" message
    const checkingMsg = await bot.sendMessage(chatId, '⏳ Перевіряємо статус оплати...');
    
    // Check payment status
    
    const paymentController = new PaymentController();
    const localStorage = new LocalStorage('./scratch');


    const transactionId = localStorage.getItem("transaction_id")
    
    const transaction = await paymentController.checkPaymentStatus(transactionId);
    
    if (transaction.payment_status === 'paid') {
      // Payment successful
      await bot.editMessageText(
        '✅ Оплата успішно виконана! Талони додано до вашого особистого кабінету.',
        {
          chat_id: chatId,
          message_id: checkingMsg.message_id
        }
      );
      
      // Reset session
      delete userSessions[chatId];
      
      // Show options
      await bot.sendMessage(
        chatId,
        'Перегляньте придбані талони в розділі "🎫 Мої талони".',
        {
          reply_markup: {
            keyboard: [
              ['🎫 Мої талони'],
              ['🛒 Придбати талони'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    } else if (transaction.payment_status === 'failed') {
      // Payment failed
      await bot.editMessageText(
        '❌ Оплата не пройшла. Спробуйте оформити замовлення знову.',
        {
          chat_id: chatId,
          message_id: checkingMsg.message_id
        }
      );
      
      // Reset session
      delete userSessions[chatId];
      
      // Show options
      await bot.sendMessage(
        chatId,
        'Ви можете спробувати знову або звернутися до служби підтримки.',
        {
          reply_markup: {
            keyboard: [
              ['🛒 Придбати талони'],
              ['📞 Підтримка'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    } else {
      // Payment still pending
      await bot.editMessageText(
        '⏳ Оплата ще обробляється. Перевірте статус пізніше або перейдіть за посиланням оплати.',
        {
          chat_id: chatId,
          message_id: checkingMsg.message_id
        }
      );
      
      // Show options
      await bot.sendMessage(
        chatId,
        'Ви можете перевірити статус пізніше за допомогою команди /status.',
        {
          reply_markup: {
            keyboard: [
              ['🎫 Мої талони'],
              ['📞 Підтримка'],
              ['🔙 Назад до меню']
            ],
            resize_keyboard: true
          }
        }
      );
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    await bot.sendMessage(
      chatId,
      'Сталася помилка при перевірці статусу оплати. Спробуйте пізніше.'
    );
  }
});

// Handler for canceling the purchase
bot.onText(/❌ Скасувати/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Reset user session
  delete userSessions[chatId];
  
  // Show main menu
  await bot.sendMessage(chatId, 
    `Замовлення скасовано. Повертаємось до головного меню.`, 
    {
      reply_markup: {
        keyboard: [
          ['🔍 Моніторинг цін', '🛒 Придбати талони'],
              ['🎫 Мої талони', '🤖 AI асистент'],
              ['📞 Підтримка', '👤 Мій профіль'],
              ['🤝 Стати партнером']
        ],
        resize_keyboard: true
      }
    }
  );
});




// Handler for "Підтримка" button
bot.onText(/📞 Підтримка/, async (msg) => {
  const chatId = msg.chat.id;
  
  await bot.sendMessage(chatId, 
    `Якщо у вас виникли питання або проблеми, зв'яжіться з нашою службою підтримки:\n\n` +
    `📱 Телефон: 0 800 33 61 51\n` +
    `✉️ Email: info@hubdrive.site\n` +
    `⏰ Графік роботи: Пн-Пт: 7:00-24:00`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📄 Публічна оферта', callback_data: 'public_offer' },
            { text: '🔒 Політика конфіденційності', callback_data: 'privacy_policy' }
          ]
        ]
      }
    }
  );
});

// Обробник натискання кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    if (data === 'back_to_menu') {
      return sendMainMenu(chatId);
    }

    let documentUrl = '';
    let caption = '';

    switch (data) {
      case 'public_offer':
        documentUrl = 'https://hubdrive.site/assets/offer.pdf';
        caption = '📜 *Договір публічної оферти*\n\nБудь ласка, ознайомтеся з документом.';
        break;

      case 'privacy_policy':
        documentUrl = 'https://hubdrive.site/assets/privacy.pdf';
        caption = '🔐 *Політика конфіденційності*\n\nЗахист ваших даних – наш пріоритет!';
        break;

      default:
        return bot.sendMessage(chatId, '❌ Невідома команда.');
    }

    await bot.sendMessage(chatId, '📥 Завантаження документа...');
    
    await bot.sendDocument(chatId, documentUrl, {
      caption: caption,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Назад до меню', callback_data: 'back_to_menu' }]
        ]
      }
    });

  } catch (error) {
    console.error('Помилка при надсиланні документа:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка при надсиланні документа. Спробуйте пізніше.');
  }

  await bot.answerCallbackQuery(query.id);
});

// Функція для повернення в головне меню
function sendMainMenu(chatId) {
  return bot.sendMessage(chatId, '🏠 *Головне меню*', {
    parse_mode: 'Markdown',
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
  });
}


// Handler for "Стати партнером" button
bot.onText(/🤝 Стати партнером/, async (msg) => {
  const chatId = msg.chat.id;

  const messageText = `🚀 *Стати партнером HubDrive* 🚀\n\n` +
    `📩 *Напишіть нам на email:* info@hubdrive.site\n\n` +
    `💡 Або відвідайте наш сайт для деталей.`;

  await bot.sendMessage(chatId, messageText, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 Відвідати сайт', url: 'https://hubdrive.site' }],
        [{ text: '🔙 Назад до меню', callback_data: 'back_to_menu' }]
      ]
    }
  });
});


console.log('Telegram bot started successfully');
return bot;
};

module.exports = startBot;