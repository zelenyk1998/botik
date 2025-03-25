// routes/api/webhooks.js

const express = require('express');
const router = express.Router();
const paymentController = require('../../connectors/payments_gateway/paymentController');
const Transaction = require('../../models/Transaction');

// Webhook для сповіщень від NovaPay
router.post('/novapay', async (req, res) => {
  try {
    const { session_id, status, merchant_id } = req.body;
    
    // Перевірка що хук від потрібного мерчанта
    if (merchant_id !== process.env.NOVAPAY_MERCHANT_ID) {
      return res.status(403).json({ error: 'Invalid merchant ID' });
    }
    
    // Знаходимо транзакцію за session_id
    const transaction = await Transaction.findOne({
      where: {
        payment_details: {
          session_id: session_id
        }
      }
    });
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    let newStatus = 'pending';
    
    // Конвертуємо статус NovaPay в наш формат
    switch (status) {
      case 'Success':
        newStatus = 'completed';
        break;
      case 'Failed':
        newStatus = 'failed';
        break;
    }
    
    // Якщо статус не змінився, просто відповідаємо успіхом
    if (newStatus === transaction.payment_status) {
      return res.status(200).json({ status: 'ok' });
    }
    
    // Оновлюємо статус в нашій базі
    await transaction.update({
      payment_status: newStatus,
      payment_details: {
        ...transaction.payment_details,
        provider_status: status,
        webhook_received: new Date()
      }
    });
    
    // Якщо оплата успішна, призначаємо талони користувачу
    if (newStatus === 'completed') {
      await paymentController.assignVouchersToUser(transaction);
    }
    
    // Відповідаємо успіхом
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;