const { Voucher, GasStation, FuelType, User } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const QRService = require('../services/qrService');

class VoucherController {
  // Створення нового талону
  static async createVoucher(voucherData) {
    try {
      const voucher = await Voucher.create({
        code: this.generateVoucherCode(),
        gas_station_id: voucherData.gasStationId,
        fuel_type_id: voucherData.fuelTypeId,
        amount: voucherData.amount,
        purchase_price: voucherData.purchasePrice,
        expiration_date: voucherData.expirationDate || this.calculateExpirationDate(),
        is_used: false
      });

      logger.info(`Створено новий талон: ${voucher.id}`);
      return voucher;
    } catch (error) {
      logger.error(`Помилка створення талону: ${error.message}`);
      throw error;
    }
  }

  // Генерація унікального коду талону
  static generateVoucherCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 8;
    let code = '';
    
    for (let i = 0; i < codeLength; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return code;
  }

  // Розрахунок терміну придатності талону (наприклад, 3 місяці з дати створення)
  static calculateExpirationDate() {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date;
  }

  // Пошук доступних талонів
  static async findAvailableVouchers(filters = {}) {
    try {
      const whereCondition = {
        owner_id: null,
        is_used: false,
        expiration_date: { [Op.gt]: new Date() },
        ...filters
      };

      const vouchers = await Voucher.findAll({
        where: whereCondition,
        include: [
          { model: GasStation, as: 'gasStation' },
          { model: FuelType, as: 'fuelType' }
        ]
      });

      return vouchers;
    } catch (error) {
      logger.error(`Помилка пошуку талонів: ${error.message}`);
      throw error;
    }
  }

  // Придбання талону
  static async purchaseVouchers(userId, voucherIds) {
    const transaction = await Voucher.sequelize.transaction();

    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Користувача не знайдено');
      }

      const vouchers = await Voucher.findAll({
        where: {
          id: { [Op.in]: voucherIds },
          owner_id: null,
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        },
        transaction
      });

      if (vouchers.length !== voucherIds.length) {
        throw new Error('Деякі талони вже придбані або недоступні');
      }

      // Призначення власника та генерація QR-кодів
      const updatedVouchers = await Promise.all(vouchers.map(async (voucher) => {
        const updatedVoucher = await voucher.update({
          owner_id: userId,
          purchased_at: new Date()
        }, { transaction });

        // Генерація QR-коду
        await QRService.generateVoucherQR(updatedVoucher);

        return updatedVoucher;
      }));

      await transaction.commit();

      logger.info(`Користувач ${userId} придбав ${updatedVouchers.length} талонів`);
      return updatedVouchers;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Помилка придбання талонів: ${error.message}`);
      throw error;
    }
  }

  // Отримання талонів користувача
  static async getUserVouchers(userId, filters = {}) {
    try {
      const whereCondition = {
        owner_id: userId,
        ...filters
      };

      const vouchers = await Voucher.findAll({
        where: whereCondition,
        include: [
          { model: GasStation, as: 'gasStation' },
          { model: FuelType, as: 'fuelType' }
        ],
        order: [['expiration_date', 'ASC']]
      });

      return vouchers;
    } catch (error) {
      logger.error(`Помилка отримання талонів користувача: ${error.message}`);
      throw error;
    }
  }

  // Використання талону
  static async useVoucher(voucherId, usageData) {
    const transaction = await Voucher.sequelize.transaction();

    try {
      const voucher = await Voucher.findByPk(voucherId, { transaction });

      if (!voucher) {
        throw new Error('Талон не знайдено');
      }

      if (voucher.is_used) {
        throw new Error('Талон вже використаний');
      }

      const updatedVoucher = await voucher.update({
        is_used: true,
        used_at: new Date(),
        usage_location: usageData.location,
        usage_details: usageData.details
      }, { transaction });

      await transaction.commit();

      logger.info(`Талон ${voucherId} використано`);
      return updatedVoucher;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Помилка використання талону: ${error.message}`);
      throw error;
    }
  }

  // Статистика талонів
  static async getVoucherStatistics() {
    try {
      const totalVouchers = await Voucher.count();
      const availableVouchers = await Voucher.count({
        where: {
          owner_id: null,
          is_used: false,
          expiration_date: { [Op.gt]: new Date() }
        }
      });
      const usedVouchers = await Voucher.count({
        where: { is_used: true }
      });
      const expiredVouchers = await Voucher.count({
        where: {
          is_used: false,
          expiration_date: { [Op.lt]: new Date() }
        }
      });

      return {
        totalVouchers,
        availableVouchers,
        usedVouchers,
        expiredVouchers
      };
    } catch (error) {
      logger.error(`Помилка отримання статистики талонів: ${error.message}`);
      throw error;
    }
  }
}

module.exports = VoucherController;