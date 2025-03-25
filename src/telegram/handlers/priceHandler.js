const { GasStation, Price, FuelType } = require('../../models');
const logger = require('../utils/logger');

module.exports = (bot, sessionService) => {
  // Обробник кнопки "Моніторинг цін"
  bot.onText(/🔍 Моніторинг цін/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Пошук активних АЗС
      const gasStations = await GasStation.findAll({
        where: { is_active: true }
      });
      
      if (gasStations.length === 0) {
        return bot.sendMessage(chatId, 'Наразі немає доступних мереж АЗС.');
      }
      
      let message = '💰 Актуальні ціни на пальне:\n\n';
      
      // Перебір кожної АЗС
      for (const station of gasStations) {
        message += `⛽ ${station.name}\n`;
        
        // Отримання цін для АЗС
        const prices = await Price.findAll({
          where: { 
            gas_station_id: station.id,
            is_active: true
          },
          include: [{
            model: FuelType, 
            as: 'fuelType',
            where: { is_active: true }
          }]
        });
        
        if (!prices || prices.length === 0) {
          message += '   Немає доступних цін\n\n';
          continue;
        }
        
        // Групування цін за типом пального
        const pricesByFuelType = {};
        for (const price of prices) {
          if (!pricesByFuelType[price.fuelType.name]) {
            pricesByFuelType[price.fuelType.name] = [];
          }
          pricesByFuelType[price.fuelType.name].push(price);
        }
        
        // Виведення цін за типами пального
        for (const [fuelTypeName, fuelPrices] of Object.entries(pricesByFuelType)) {
          message += `   🔹 ${fuelTypeName}:\n`;
          for (const price of fuelPrices) {
            message += `      ${price.amount} л - ${price.price} грн\n`;
          }
        }
        
        message += '\n';
      }
      
      message += 'Для придбання талонів натисніть кнопку "🛒 Придбати талони"';
      
      const markup = {
        reply_markup: {
          keyboard: [
            ['🛒 Придбати талони'],
            ['🎫 Мої талони'],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      };
      
      // Оновлення сесії
      sessionService.update(chatId, { state: 'price_monitoring' });
      
      await bot.sendMessage(chatId, message, markup);
    } catch (error) {
      logger.error(`Помилка при отриманні цін: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка при отриманні цін. Спробуйте пізніше.');
    }
  });

  // Додаткові методи для розширеного моніторингу цін
  
  // Порівняння цін між АЗС
  bot.onText(/🔄 Порівняти ціни/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Отримання всіх активних типів палива
      const fuelTypes = await FuelType.findAll({
        where: { is_active: true }
      });
      
      let comparisonMessage = '🔍 Порівняння цін по мережах АЗС:\n\n';
      
      // Для кожного типу палива
      for (const fuelType of fuelTypes) {
        comparisonMessage += `⚡ ${fuelType.name}:\n`;
        
        // Пошук найнижчих та найвищих цін
        const stations = await GasStation.findAll({
          include: [{
            model: Price,
            as: 'prices',
            where: { 
              fuel_type_id: fuelType.id,
              is_active: true 
            },
            required: true
          }],
          attributes: ['name']
        });
        
        const prices = stations.map(station => ({
          stationName: station.name,
          price: station.prices[0].price
        }));
        
        const sortedPrices = prices.sort((a, b) => a.price - b.price);
        
        comparisonMessage += `   🟢 Найдешевше: ${sortedPrices[0].stationName} - ${sortedPrices[0].price} грн\n`;
        comparisonMessage += `   🔴 Найдорожче: ${sortedPrices[sortedPrices.length - 1].stationName} - ${sortedPrices[sortedPrices.length - 1].price} грн\n\n`;
      }
      
      // Додаткові кнопки
      const markup = {
        reply_markup: {
          keyboard: [
            ['🛒 Придбати талони'],
            ['🔍 Моніторинг цін'],
            ['🔙 Назад до меню']
          ],
          resize_keyboard: true
        }
      };
      
      await bot.sendMessage(chatId, comparisonMessage, markup);
    } catch (error) {
      logger.error(`Помилка при порівнянні цін: ${error.message}`);
      await bot.sendMessage(chatId, 'Сталася помилка при порівнянні цін.');
    }
  });
};