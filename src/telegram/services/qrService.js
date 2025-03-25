const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class QRService {
  // Директорія для збереження QR-кодів
  static QR_DIRECTORY = path.join(__dirname, '..', 'storage', 'qr_codes');

  /**
   * Генерація QR-коду для талону
   * @param {Object} voucher - Об'єкт талону
   * @returns {Promise<string>} - Шлях до згенерованого QR-коду
   */
  static async generateVoucherQR(voucher) {
    try {
      // Перевірка та створення директорії, якщо її не існує
      await this.ensureQRDirectoryExists();

      // Формування унікального імені файлу
      const filename = `voucher_${voucher.id}_${voucher.code}.png`;
      const filepath = path.join(this.QR_DIRECTORY, filename);

      // Дані для QR-коду
      const qrData = JSON.stringify({
        voucherId: voucher.id,
        code: voucher.code,
        gasStationId: voucher.gas_station_id,
        fuelTypeId: voucher.fuel_type_id,
        amount: voucher.amount,
        expirationDate: voucher.expiration_date
      });

      // Опції генерації QR-коду
      const qrOptions = {
        errorCorrectionLevel: 'H', // Високий рівень корекції помилок
        width: 300, // Ширина QR-коду
        margin: 4  // Зовнішній відступ
      };

      // Генерація QR-коду
      await QRCode.toFile(filepath, qrData, qrOptions);

      logger.info(`QR-код згенеровано: ${filename}`);
      return filepath;
    } catch (error) {
      logger.error(`Помилка генерації QR-коду: ${error.message}`);
      throw error;
    }
  }

  /**
   * Генерація QR-коду для транзакції
   * @param {Object} transaction - Об'єкт транзакції
   * @returns {Promise<string>} - Шлях до згенерованого QR-коду
   */
  static async generateTransactionQR(transaction) {
    try {
      await this.ensureQRDirectoryExists();

      const filename = `transaction_${transaction.id}.png`;
      const filepath = path.join(this.QR_DIRECTORY, filename);

      const qrData = JSON.stringify({
        transactionId: transaction.id,
        userId: transaction.user_id,
        amount: transaction.amount,
        status: transaction.status,
        createdAt: transaction.created_at
      });

      const qrOptions = {
        errorCorrectionLevel: 'M',
        width: 250,
        margin: 2
      };

      await QRCode.toFile(filepath, qrData, qrOptions);

      logger.info(`QR-код транзакції згенеровано: ${filename}`);
      return filepath;
    } catch (error) {
      logger.error(`Помилка генерації QR-коду транзакції: ${error.message}`);
      throw error;
    }
  }

  /**
   * Перевірка та створення директорії для QR-кодів
   */
  static async ensureQRDirectoryExists() {
    try {
      await fs.mkdir(this.QR_DIRECTORY, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        logger.error(`Помилка створення директорії QR-кодів: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Видалення старих QR-кодів
   * @param {number} [daysOld=7] - Кількість днів для видалення
   */
  static async cleanupOldQRCodes(daysOld = 7) {
    try {
      const files = await fs.readdir(this.QR_DIRECTORY);
      const now = new Date();

      for (const file of files) {
        const filepath = path.join(this.QR_DIRECTORY, file);
        const stats = await fs.stat(filepath);
        
        // Різниця в днях
        const daysDiff = (now - stats.mtime) / (1000 * 60 * 60 * 24);

        if (daysDiff > daysOld) {
          await fs.unlink(filepath);
          logger.info(`Видалено застарілий QR-код: ${file}`);
        }
      }
    } catch (error) {
      logger.error(`Помилка очищення QR-кодів: ${error.message}`);
    }
  }

  /**
   * Декодування QR-коду
   * @param {string} filepath - Шлях до файлу QR-коду
   * @returns {Promise<Object>} - Декодовані дані
   */
  static async decodeQR(filepath) {
    try {
      const qrCodeModule = await import('qrcode-reader');
      const Jimp = await import('jimp');

      // Читання зображення
      const image = await Jimp.read(filepath);

      // Створення декодера
      const qr = new qrCodeModule.default();

      // Декодування
      return new Promise((resolve, reject) => {
        qr.callback = (err, result) => {
          if (err) {
            logger.error(`Помилка декодування QR-коду: ${err.message}`);
            reject(err);
          } else {
            // Парсинг JSON-даних
            try {
              const decodedData = JSON.parse(result.result);
              resolve(decodedData);
            } catch (parseError) {
              logger.error(`Помилка парсингу QR-коду: ${parseError.message}`);
              reject(parseError);
            }
          }
        };

        qr.decode(image.bitmap);
      });
    } catch (error) {
      logger.error(`Помилка декодування QR-коду: ${error.message}`);
      throw error;
    }
  }
}

module.exports = QRService;