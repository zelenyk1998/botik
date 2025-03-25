const { DataTypes } = require('sequelize');
const { sequelize } = require('../db/config');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegram_id: {
    type: DataTypes.STRING,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    unique: true
  },
  password: {
    type: DataTypes.STRING
  },
  phone_number: {
    type: DataTypes.STRING
  },
  first_name: {
    type: DataTypes.STRING
  },
  last_name: {
    type: DataTypes.STRING
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  joined_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_active: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  // Видаляємо пароль при перетворенні об'єкту в JSON
  toJSON: {
    transform: function(doc, plain) {
      delete plain.password;
      return plain;
    }
  },
  // Хешування пароля перед збереженням в базі
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        console.log('Original password:', user.password);
        user.password = await bcrypt.hash(user.password, 10);
        console.log('Hashed password:', user.password);
      }
    },
    beforeUpdate: async (user) => {
      if (user.password) {
        console.log('Original password (update):', user.password);
        user.password = await bcrypt.hash(user.password, 10);
        console.log('Hashed password (update):', user.password);
      }
    }
  }
  
});

module.exports = User;
