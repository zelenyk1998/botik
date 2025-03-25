const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  sent_to: {
    type: DataTypes.ENUM('all', 'active', 'inactive', 'specific'),
    defaultValue: 'all'
  },
  sent_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  image_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Додаємо поле для зберігання ID користувачів, яким було надіслано повідомлення
  recipient_ids: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  // Додаємо поле для ID користувача, який створив повідомлення
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Додаємо поле для часу закінчення розсилки
  send_completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'messages',
  timestamps: true,
  underscored: true
});

module.exports = Message;