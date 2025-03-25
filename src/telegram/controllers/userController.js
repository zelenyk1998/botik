const { User } = require('../../models');
const logger = require('../utils/logger');

class UserController {
  // Створення нового користувача
  static async createUser(userData) {
    try {
      const user = await User.create({
        telegram_id: userData.telegram_id,
        username: userData.username || null,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        phone_number: userData.phone_number || null,
        joined_date: new Date(),
        last_active: new Date()
      });

      logger.info(`Новий користувач створений: ${user.id}`);
      return user;
    } catch (error) {
      logger.error(`Помилка створення користувача: ${error.message}`);
      throw error;
    }
  }

  // Оновлення інформації про користувача
  static async updateUser(telegramId, updateData) {
    try {
      const [updatedRowsCount, updatedUsers] = await User.update(
        {
          ...updateData,
          last_active: new Date()
        },
        {
          where: { telegram_id: telegramId },
          returning: true // Повертає оновлений запис
        }
      );

      if (updatedRowsCount === 0) {
        logger.warn(`Користувача з telegram_id ${telegramId} не знайдено`);
        return null;
      }

      logger.info(`Профіль користувача оновлено: ${updatedUsers[0].id}`);
      return updatedUsers[0];
    } catch (error) {
      logger.error(`Помилка оновлення користувача: ${error.message}`);
      throw error;
    }
  }

  // Пошук користувача за Telegram ID
  static async findUserByTelegramId(telegramId) {
    try {
      const user = await User.findOne({
        where: { telegram_id: telegramId },
        attributes: { exclude: ['password'] } // Виключаємо чутливі дані
      });

      return user;
    } catch (error) {
      logger.error(`Помилка пошуку користувача: ${error.message}`);
      throw error;
    }
  }

  // Додавання номера телефону
  static async addPhoneNumber(telegramId, phoneNumber) {
    try {
      // Перевірка формату номера телефону
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      const [updatedRowsCount, updatedUsers] = await User.update(
        { 
          phone_number: formattedPhone,
          phone_verified: true
        },
        {
          where: { telegram_id: telegramId },
          returning: true
        }
      );

      if (updatedRowsCount === 0) {
        logger.warn(`Користувача з telegram_id ${telegramId} не знайдено`);
        return null;
      }

      logger.info(`Номер телефону додано для користувача: ${updatedUsers[0].id}`);
      return updatedUsers[0];
    } catch (error) {
      logger.error(`Помилка додавання номера телефону: ${error.message}`);
      throw error;
    }
  }

  // Форматування номера телефону
  static formatPhoneNumber(phoneNumber) {
    // Видаляємо всі символи крім цифр
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Додаємо + на початок, якщо немає
    const formatted = cleaned.startsWith('38') 
      ? `+${cleaned}` 
      : cleaned.startsWith('0') 
        ? `+38${cleaned}` 
        : `+38${cleaned}`;
    
    return formatted;
  }

  // Отримання статистики користувачів
  static async getUserStatistics() {
    try {
      const totalUsers = await User.count();
      const newUsersToday = await User.count({
        where: {
          joined_date: {
            [Op.gte]: new Date(new Date().setHours(0,0,0,0))
          }
        }
      });
      const activeUsersLastMonth = await User.count({
        where: {
          last_active: {
            [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 1))
          }
        }
      });

      return {
        totalUsers,
        newUsersToday,
        activeUsersLastMonth
      };
    } catch (error) {
      logger.error(`Помилка отримання статистики користувачів: ${error.message}`);
      throw error;
    }
  }
}

module.exports = UserController;