// connectors/payment_gateway/paymentController.js

const NovaPay = require('./NovaPay/NovaPay');
const { Transaction, Voucher, TransactionVoucher } = require('../../models');

// Ініціалізація NovaPay
const novapay = new NovaPay({
  apiSign: process.env.NOVAPAY_API_SIGN
});

// ID мерчанта з env-файлу
const MERCHANT_ID = process.env.NOVAPAY_MERCHANT_ID;

// Обробник платежів
class PaymentController {
  // Створення нової транзакції для талонів
  async createTransaction(userId, vouchers, phoneNumber) {
    try {
       console.log('Початок створення транзакції');
    console.log('userId:', userId);
    console.log('vouchers:', JSON.stringify(vouchers));
    console.log('phoneNumber:', phoneNumber);
      // 1. Створюємо транзакцію в нашій базі даних
      const totalAmount = vouchers.reduce((sum, v) => sum + v.purchase_price, 0);
      
      const transaction = await Transaction.create({
        user_id: userId,
        total_amount: totalAmount,
        payment_status: 'pending',
        payment_method: 'card',
        payment_details: {
          provider: 'novapay',
          vouchers: vouchers.map(v => v.id)
        }
      });
      
      // 2. Зв'язуємо транзакцію з талонами
      for (const voucher of vouchers) {
        await TransactionVoucher.create({
          transaction_id: transaction.id,
          voucher_id: voucher.id,
          price_at_purchase: voucher.purchase_price
        });
      }
      
      // 3. Створюємо сесію оплати в NovaPay
      const sessionResponse = await novapay.createSession(
        MERCHANT_ID,
        phoneNumber // Телефон клієнта в форматі +380XXXXXXXXX
      );

      
      if (!sessionResponse.data || !sessionResponse.data.id) {
        throw new Error('Failed to create payment session');
      }
      
      // 4. Додаємо деталі платежу в сесію
      const paymentResponse = await novapay.addPaymentWithProductsParam(
        MERCHANT_ID,
        sessionResponse.data.id,
        totalAmount,
        vouchers.map(v => ({
          description: `ID: ${v.id}
          Талон ${v.code} (${v.amount}л)`,
          price: v.purchase_price,
          count: 1
        }))
      );
      
      if (!paymentResponse.data) {
        throw new Error('Failed to add payment details');
      }
      
      // 5. Оновлюємо транзакцію з даними сесії
      await transaction.update({
        payment_details: {
          ...transaction.payment_details,
          session_id: sessionResponse.data.id,
          payment_url: paymentResponse.data.url
        }
      });
      
      // 6. Повертаємо дані для оплати
      return {
        transaction_id: transaction.id,
        payment_url: paymentResponse.data.url,
        session_id: sessionResponse.data.id
      };
    } catch (error) {
      console.error('Детальна помилка створення платежу:', error);
      throw error;
    }
  }
  
  // Перевірка статусу платежу
  async checkPaymentStatus(transactionId) {
    try {
      const transaction = await Transaction.findByPk(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }


      // Якщо вже оплачено або відхилено, повертаємо поточний статус
      if (transaction.payment_status !== 'pending') {
        return {
          transaction_id: transaction.id,
          status: transaction.payment_status
        };
      }
      
      // Отримуємо session_id з деталей платежу
      const sessionId = transaction.payment_details.session_id;
      
      if (!sessionId) {
        throw new Error('Invalid transaction data: no session_id');
      }
      
      // Перевіряємо статус в NovaPay
      const statusResponse = await novapay.getStatus(MERCHANT_ID, sessionId);
      
      if (!statusResponse.data) {
        throw new Error('Failed to check payment status');
      }
      
      let newStatus = 'pending';
      
      // Конвертуємо статус NovaPay в наш формат
      switch (statusResponse.data.status) {
        case 'paid':
          newStatus = 'paid';
          break;
        case 'failed':
          newStatus = 'failed';
          break;
      }
      
      // Оновлюємо статус в нашій базі
      if (newStatus !== 'pending') {
        await transaction.update({
          payment_status: newStatus,
          payment_details: {
            ...transaction.payment_details,
            payment_status: statusResponse.data.status,
            payment_date: new Date()
          }
        });
        
        // Якщо оплата успішна, призначаємо талони користувачу
        if (newStatus === 'paid') {
          await this.assignVouchersToUser(transaction);
        }
      }
      
      return {
        transaction_id: transaction.id,
        status: newStatus,
        payment_status: statusResponse.data.status
      };
    } catch (error) {
      console.error('Payment status check error:', error);
      throw error;
    }
  }
  
  // Призначення талонів користувачу після успішної оплати
  async assignVouchersToUser(transaction) {
    try {
      const transactionVouchers = await TransactionVoucher.findAll({
        where: { transaction_id: transaction.id }
      });
      
      const now = new Date();
      
      for (const tv of transactionVouchers) {
        await Voucher.update(
          {
            owner_id: transaction.user_id,
            purchased_at: now
          },
          { where: { id: tv.voucher_id } }
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error assigning vouchers:', error);
      throw error;
    }
  }
  
  // Скасування платежу
  async cancelPayment(transactionId) {
    try {
      const transaction = await Transaction.findByPk(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }
      
      // Перевіряємо чи платіж в статусі "очікує"
      if (transaction.payment_status !== 'pending') {
        throw new Error(`Cannot cancel transaction with status ${transaction.payment_status}`);
      }
      
      const sessionId = transaction.payment_details.session_id;
      
      if (!sessionId) {
        throw new Error('Invalid transaction data: no session_id');
      }
      
      // Скасовуємо сесію в NovaPay
      await novapay.voidSession(MERCHANT_ID, sessionId);
      
      // Оновлюємо статус у нашій базі
      await transaction.update({
        payment_status: 'failed',
        payment_details: {
          ...transaction.payment_details,
          canceled_at: new Date(),
          canceled_reason: 'User canceled payment'
        }
      });
      
      return {
        transaction_id: transaction.id,
        status: 'canceled'
      };
    } catch (error) {
      console.error('Payment cancellation error:', error);
      throw error;
    }
  }
}

module.exports =  PaymentController;