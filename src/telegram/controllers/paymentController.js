const axios = require('axios');
const { Transaction, User, Voucher } = require('../../models');
const config = require('../config/config');
const logger = require('../utils/logger');
const VoucherController = require('./voucherController');

class PaymentController {
  // Створення транзакції
  static async createTransaction(userId, vouchers, phoneNumber) {
    const transaction = await Transaction.sequelize.transaction();

    try {
      // Перевірка користувача
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('Користувача не знайдено');
      }

      // Розрахунок загальної суми
      const totalAmount = vouchers.reduce((sum, voucher) => sum + voucher.purchase_price, 0);

      // Створення запису транзакції
      const paymentTransaction = await Transaction.create({
        user_id: userId,
        amount: totalAmount,
        status: 'pending',
        phone_number: phoneNumber,
        voucher_ids: vouchers.map(v => v.id)
      }, { transaction });

      // Виклик зовнішнього платіжного шлюзу
      const paymentResponse = await this.initiatePayment({
        transactionId: paymentTransaction.id,
        amount: totalAmount,
        phoneNumber,
        vouchers
      });

      // Оновлення транзакції деталями платежу
      await paymentTransaction.update({
        external_payment_id: paymentResponse.payment_id,
        payment_url: paymentResponse.payment_url
      }, { transaction });

      await transaction.commit();

      logger.info(`Створено транзакцію: ${paymentTransaction.id}`);
      return {
        transaction_id: paymentTransaction.id,
        payment_url: paymentResponse.payment_url,
        total_amount: totalAmount
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Помилка створення транзакції: ${error.message}`);
      throw error;
    }
  }

  // Ініціалізація платежу через зовнішній платіжний шлюз
  static async initiatePayment(paymentData) {
    try {
      const response = await axios.post(`${config.payment.gateway}/create-payment`, {
        transaction_id: paymentData.transactionId,
        amount: paymentData.amount,
        phone_number: paymentData.phoneNumber,
        description: `Придбання талонів (${paymentData.vouchers.length} шт.)`,
        return_url: config.payment.returnUrl,
        webhook_url: config.payment.webhookUrl
      }, {
        headers: {
          'Authorization': `Bearer ${config.payment.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // Перевірка відповіді від платіжного шлюзу
      if (!response.data.payment_id || !response.data.payment_url) {
        throw new Error('Некоректна відповідь від платіжного шлюзу');
      }

      return {
        payment_id: response.data.payment_id,
        payment_url: response.data.payment_url
      };
    } catch (error) {
      logger.error(`Помилка ініціалізації платежу: ${error.message}`);
      throw error;
    }
  }

  // Перевірка статусу платежу
  static async checkPaymentStatus(transactionId) {
    try {
      // Знаходимо транзакцію в базі даних
      const transaction = await Transaction.findByPk(transactionId);
      if (!transaction) {
        throw new Error('Транзакцію не знайдено');
      }

      // Запит до платіжного шлюзу
      const response = await axios.get(`${config.payment.gateway}/payment-status`, {
        params: { 
          transaction_id: transactionId 
        },
        headers: {
          'Authorization': `Bearer ${config.payment.apiKey}`
        }
      });

      // Статуси: pending, paid, failed, canceled
      const paymentStatus = response.data.status;

      // Оновлення статусу транзакції
      await transaction.update({ status: paymentStatus });

      // Якщо платіж успішний - активуємо талони
      if (paymentStatus === 'paid') {
        await this.activateVouchersForTransaction(transaction);
      }

      return {
        transaction_id: transactionId,
        payment_status: paymentStatus,
        amount: transaction.amount
      };
    } catch (error) {
      logger.error(`Помилка перевірки статусу платежу: ${error.message}`);
      throw error;
    }
  }

  // Активація талонів після успішної оплати
  static async activateVouchersForTransaction(transaction) {
    try {
      // Перетворення рядка ID талонів назад у масив
      const voucherIds = JSON.parse(transaction.voucher_ids);

      // Активація талонів для користувача
      await VoucherController.purchaseVouchers(
        transaction.user_id, 
        voucherIds
      );

      logger.info(`Талони активовані для транзакції ${transaction.id}`);
    } catch (error) {
      logger.error(`Помилка активації талонів: ${error.message}`);
      throw error;
    }
  }

  // Обробка webhook від платіжної системи
  static async handlePaymentWebhook(webhookData) {
    const transaction = await Transaction.sequelize.transaction();

    try {
      // Знаходимо транзакцію
      const paymentTransaction = await Transaction.findOne({
        where: { 
          external_payment_id: webhookData.payment_id 
        }
      }, { transaction });

      if (!paymentTransaction) {
        logger.warn(`Webhook: транзакцію не знайдено для ${webhookData.payment_id}`);
        return false;
      }

      // Оновлення статусу транзакції
      await paymentTransaction.update({
        status: webhookData.status,
        processed_at: new Date()
      }, { transaction });

      // Якщо платіж успішний - активуємо талони
      if (webhookData.status === 'paid') {
        await this.activateVouchersForTransaction(paymentTransaction);
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      logger.error(`Помилка обробки webhook: ${error.message}`);
      throw error;
    }
  }

  // Отримання статистики платежів
  static async getPaymentStatistics(period = 'month') {
    try {
      let dateFilter;
      switch (period) {
        case 'day':
          dateFilter = new Date(new Date().setHours(0,0,0,0));
          break;
        case 'week':
          dateFilter = new Date(new Date().setDate(new Date().getDate() - 7));
          break;
        case 'month':
        default:
          dateFilter = new Date(new Date().setMonth(new Date().getMonth() - 1));
      }

      const statistics = await Transaction.findAll({
        where: {
          created_at: { [Op.gte]: dateFilter },
          status: 'paid'
        },
        attributes: [
          [Transaction.sequelize.fn('SUM', Transaction.sequelize.col('amount')), 'total_revenue'],
          [Transaction.sequelize.fn('COUNT', Transaction.sequelize.col('id')), 'total_transactions']
        ],
        raw: true
      });

      return {
        period,
        total_revenue: statistics[0].total_revenue || 0,
        total_transactions: statistics[0].total_transactions || 0
      };
    } catch (error) {
      logger.error(`Помилка отримання статистики платежів: ${error.message}`);
      throw error;
    }
  }

  // Повернення коштів
  static async refundTransaction(transactionId, reason) {
    const transaction = await Transaction.sequelize.transaction();

    try {
      const paymentTransaction = await Transaction.findByPk(transactionId, { transaction });

      if (!paymentTransaction) {
        throw new Error('Транзакцію не знайдено');
      }

      // Запит до платіжного шлюзу на повернення
      const refundResponse = await axios.post(`${config.payment.gateway}/refund`, {
        transaction_id: transactionId,
        reason: reason
      }, {
        headers: {
          'Authorization': `Bearer ${config.payment.apiKey}`
        }
      });

      // Оновлення статусу транзакції
      await paymentTransaction.update({
        status: 'refunded',
        refund_reason: reason
      }, { transaction });

      // Анулювання талонів
      const voucherIds = JSON.parse(paymentTransaction.voucher_ids);
      await Voucher.update(
        { 
          owner_id: null, 
          is_used: false 
        },
        { 
          where: { id: voucherIds },
          transaction 
        }
      );

      await transaction.commit();

      logger.info(`Транзакцію ${transactionId} повернено`);
      return {
        transaction_id: transactionId,
        status: 'refunded'
      };
    } catch (error) {
      await transaction.rollback();
      logger.error(`Помилка повернення коштів: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PaymentController;