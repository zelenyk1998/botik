const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Отримання токена з заголовка
  const token = req.header('x-auth-token');

  // Перевірка наявності токена
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Верифікація токена
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Додавання користувача до запиту
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};