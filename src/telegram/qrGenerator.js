const qrcode = require('qrcode');

/**
 * Створює QR код з інформацією про талон
 * @param {Object} voucher - Об'єкт талону
 * @returns {Promise<Buffer>} - Буфер з QR кодом у форматі PNG
 */
const createVoucherQR = async (voucher) => {
  try {
    // Підготовка даних для QR коду
    const qrData = JSON.stringify({
      code: voucher.code,
      gasStation: voucher.GasStation ? voucher.GasStation.name : '',
      fuelType: voucher.FuelType ? voucher.FuelType.name : '',
      amount: voucher.amount,
      expirationDate: voucher.expiration_date
    });
    
    // Створення QR коду
    return await qrcode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      scale: 8
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

module.exports = { createVoucherQR };