const { GasStation, FuelType, Voucher } = require('../../models');
const VoucherController = require('../controllers/voucherController');
const PaymentController = require('../controllers/paymentController');
const UserController = require('../controllers/userController');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

module.exports = (bot, sessionService) => {
  // Обробник кнопки "Придбати талони"
  bot.onText(/🛒 Придбати талони/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Перевірка наявності номера телефону
      const user = await UserController.findUserByTelegramId(msg.from.id.toString());
      if (!user || !user.phone_number) {
        return bot.sendMessage(chatId, 
          'Для придбання талонів необхідно вказати номер телефону. Перейдіть до профілю та додайте номер.',
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

      // Пошук активних АЗС
      const gasStations = await GasStation.findAll({
        where: { is_active: true }
      });
      
      if (gasStations.length === 0) {
        return bot.sendMessage(chatId, 'Наразі немає доступних мереж АЗС.');
      }
      
      // Створення сесії
      sessionService.update(chatId, { 
        state: 'selecting_gas_station',
        userId: user.id
      });
      
      const markup = {
        reply_markup: {
          keyboard: gasStations.map(station => [`⛽ ${station.name}`]).concat([['🔙 Назад до меню']]),
          resize_keyboard: true
        }
      };
      
      await bot.sendMessage(chatId, 'Виберіть мережу АЗС для придбання талонів:', markup);
    } catch (error) {
      logger.error(`Помилка при виборі АЗС: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник вибору АЗС
  bot.onText(/⛽ (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const stationName = match[1];
    const session = sessionService.get(chatId);

    if (!session || session.state !== 'selecting_gas_station') {
      return;
    }

    try {
      // Знаходження АЗС
      const gasStation = await GasStation.findOne({
        where: { name: stationName, is_active: true }
      });

      if (!gasStation) {
        return bot.sendMessage(chatId, 'Мережу АЗС не знайдено.');
      }

      // Оновлення сесії
      sessionService.update(chatId, {
        state: 'selecting_fuel_type',
        gasStationId: gasStation.id,
        stationName: gasStation.name
      });

      // Пошук доступних типів палива
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

      // Знаходження активних типів палива
      const availableFuelTypes = await FuelType.findAll({
        where: {
          id: { [Op.in]: availableFuelTypeIds },
          is_active: true
        },
        attributes: ['id', 'name']
      });

      // Створення клавіатури
      const markup = {
        reply_markup: {
          keyboard: availableFuelTypes.map(type => [`⚡ ${type.name}`]).concat([['🔙 Назад до меню']]),
          resize_keyboard: true
        }
      };

      await bot.sendMessage(chatId, 'Виберіть вид пального:', markup);
    } catch (error) {
      logger.error(`Помилка при виборі типу палива: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник вибору типу палива
  bot.onText(/⚡ (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const fuelTypeName = match[1];
    const session = sessionService.get(chatId);

    if (!session || session.state !== 'selecting_fuel_type') {
      return;
    }

    try {
      // Знаходження типу палива
      const fuelType = await FuelType.findOne({
        where: {
          name: fuelTypeName,
          is_active: true
        }
      });

      if (!fuelType) {
        return bot.sendMessage(chatId, 'Вид пального не знайдено.');
      }

      // Оновлення сесії
      sessionService.update(chatId, {
        state: 'selecting_amount',
        fuelTypeId: fuelType.id,
        fuelTypeName: fuelType.name
      });

      // Пошук доступних обсягів
      const availableAmounts = await Voucher.findAll({
        where: {
          gas_station_id: session.gasStationId,
          fuel_type_id: fuelType.id,
          owner_id: null,
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        },
        attributes: ['amount'],
        raw: true
      }).then(vouchers => [...new Set(vouchers.map(v => v.amount))]);

      if (availableAmounts.length === 0) {
        return bot.sendMessage(chatId, 'Наразі немає доступних талонів для цього виду пального.');
      }

      // Створення клавіатури
      const markup = {
        reply_markup: {
          keyboard: availableAmounts.map(amount => [`🔢 ${amount} л`]).concat([['🔙 Назад до меню']]),
          resize_keyboard: true
        }
      };

      await bot.sendMessage(chatId, 'Виберіть кількість літрів:', markup);
    } catch (error) {
      logger.error(`Помилка при виборі обсягу: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник вибору кількості літрів
  bot.onText(/🔢 (\d+) л/, async (msg, match) => {
    const chatId = msg.chat.id;
    const amount = parseInt(match[1]);
    const session = sessionService.get(chatId);

    if (!session || session.state !== 'selecting_amount') {
      return;
    }

    try {
      // Оновлення сесії
      sessionService.update(chatId, {
        state: 'entering_quantity',
        amount: amount
      });

      // Пошук доступних талонів
      const availableVouchers = await Voucher.findAll({
        where: {
          gas_station_id: session.gasStationId,
          fuel_type_id: session.fuelTypeId,
          amount: amount,
          owner_id: null,
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        },
        include: [
          { model: GasStation, as: 'gasStation' },
          { model: FuelType, as: 'fuelType' }
        ]
      });

      if (availableVouchers.length === 0) {
        return bot.sendMessage(chatId, 'Немає доступних талонів з такими параметрами.');
      }

      // Інформація про талон
      const sampleVoucher = availableVouchers[0];
      
      let message = `Ви обрали талони:\n\n`;
      message += `⛽ Мережа: ${session.stationName}\n`;
      message += `⚡ Пальне: ${session.fuelTypeName}\n`;
      message += `🔢 Кількість: ${amount} л\n`;
      message += `💰 Ціна: ${sampleVoucher.purchase_price} грн за талон\n`;
      message += `📅 Термін дії: до ${new Date(sampleVoucher.expiration_date).toLocaleDateString('uk-UA')}\n\n`;
      message += `Доступно талонів: ${availableVouchers.length}\n\n`;
      message += `Введіть бажану кількість талонів (від 1 до ${Math.min(availableVouchers.length, 20)}):`;

      // Збереження додаткової інформації в сесії
      sessionService.update(chatId, {
        availableVouchers: availableVouchers,
        pricePerVoucher: sampleVoucher.purchase_price
      });

      const markup = {
        reply_markup: {
          keyboard: [['🔙 Назад до меню']],
          resize_keyboard: true
        }
      };

      await bot.sendMessage(chatId, message, markup);
    } catch (error) {
      logger.error(`Помилка при виборі кількості талонів: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник введення кількості талонів
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const session = sessionService.get(chatId);

    // Перевірка стану сесії
    if (!session || session.state !== 'entering_quantity') {
      return;
    }

    // Пропуск команд та некоректних значень
    if (!text || text.startsWith('/') || text.startsWith('🔙') || isNaN(text)) {
      return;
    }

    try {
      const quantity = parseInt(text);
      const availableVouchers = session.availableVouchers;
      const maxQuantity = Math.min(availableVouchers.length, 20);

      // Перевірка коректності кількості
      if (quantity <= 0 || quantity > maxQuantity) {
        return bot.sendMessage(
          chatId, 
          `Будь ласка, введіть коректну кількість (від 1 до ${maxQuantity}):`
        );
      }

      // Оновлення сесії
      sessionService.update(chatId, {
        state: 'confirming_purchase',
        quantity: quantity
      });

      // Розрахунок загальної суми
      const totalPrice = quantity * session.pricePerVoucher;
      
      // Вибір талонів для покупки
      const selectedVouchers = availableVouchers.slice(0, quantity);

      //Формування повідомлення про замовлення
      let message = `💳 Підтвердження замовлення:\n\n`;
      message += `⛽ Мережа: ${session.stationName}\n`;
      message += `⚡ Пальне: ${session.fuelTypeName}\n`;
      message += `🔢 Кількість: ${session.amount} л\n`;
      message += `📦 Кількість талонів: ${quantity} шт\n`;
      message += `💰 Загальна сума: ${totalPrice} грн\n\n`;
      message += `Для підтвердження покупки натисніть кнопку "Підтвердити покупку"`;

      // Збереження талонів в сесії
      sessionService.update(chatId, {
        selectedVouchers: selectedVouchers,
        totalPrice: totalPrice
      });

      const markup = {
        reply_markup: {
          keyboard: [
            ['✅ Підтвердити покупку'],
            ['❌ Скасувати'],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      };

      await bot.sendMessage(chatId, message, markup);
    } catch (error) {
      logger.error(`Помилка при обробці кількості талонів: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка. Спробуйте пізніше.');
    }
  });

  // Обробник підтвердження покупки
  bot.onText(/✅ Підтвердити покупку/, async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionService.get(chatId);

    // Перевірка стану сесії
    if (!session || session.state !== 'confirming_purchase') {
      return;
    }

    try {
      // Створення транзакції
      const transaction = await PaymentController.createTransaction(
        session.userId,
        session.selectedVouchers,
        msg.from.phone_number
      );

      // Надсилання посилання на оплату
      await bot.sendMessage(
        chatId, 
        `🔗 Посилання для оплати: ${transaction.payment_url}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💳 Перейти до оплати', url: transaction.payment_url }]
            ]
          }
        }
      );

      // Оновлення сесії
      sessionService.update(chatId, {
        state: 'awaiting_payment',
        transactionId: transaction.transaction_id
      });
    } catch (error) {
      logger.error(`Помилка при створенні транзакції: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка при створенні замовлення.');
    }
  });

  // Обробник скасування покупки
  bot.onText(/❌ Скасувати/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Скидання сесії
    sessionService.delete(chatId);
    
    // Повернення до головного меню
    await bot.sendMessage(chatId, 
      'Замовлення скасовано. Повертаємось до головного меню.', 
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
  });

  // Перевірка статусу платежу
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const session = sessionService.get(chatId);

    if (!session || !session.transactionId) {
      return bot.sendMessage(chatId, 'Немає активних замовлень для перевірки.');
    }

    try {
      // Перевірка статусу транзакції
      const transactionStatus = await PaymentController.checkPaymentStatus(
        session.transactionId
      );

      let statusMessage = '';
      switch (transactionStatus.payment_status) {
        case 'pending':
          statusMessage = '⏳ Платіж очікує на обробку. Будь ласка, завершіть оплату.';
          break;
        case 'paid':
          statusMessage = '✅ Платіж успішно сплачено! Талони додано до вашого кабінету.';
          // Скидання сесії
          sessionService.delete(chatId);
          break;
        case 'failed':
          statusMessage = '❌ Платіж не вдався. Спробуйте ще раз або зверніться до підтримки.';
          // Скидання сесії
          sessionService.delete(chatId);
          break;
        default:
          statusMessage = '❓ Невідомий статус платежу.';
      }

      await bot.sendMessage(chatId, statusMessage, {
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
      logger.error(`Помилка перевірки статусу платежу: ${error.message}`);
      await bot.sendMessage(chatId, 'Не вдалося перевірити статус платежу.');
    }
  });

  // Обробник webhook від платіжної системи
  bot.use(async (msg, next) => {
    try {
      // Перевірка та обробка webhook-повідомлень
      if (msg.webhook_payment) {
        const result = await PaymentController.handlePaymentWebhook(msg.webhook_payment);
        
        if (result) {
          const transaction = await Transaction.findByPk(msg.webhook_payment.transaction_id);
          const user = await User.findByPk(transaction.user_id);

          // Надсилання повідомлення користувачеві
          if (user) {
            await bot.sendMessage(user.telegram_id, 
              transaction.status === 'paid' 
                ? '✅ Ваше замовлення успішно оплачено!' 
                : '❌ Виникла проблема з оплатою замовлення.'
            );
          }
        }
      }
      next();
    } catch (error) {
      logger.error(`Помилка обробки webhook: ${error.message}`);
      next();
    }
  });
};