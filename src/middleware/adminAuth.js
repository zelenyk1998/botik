const { User } = require('../models');

module.exports = async function(req, res, next) {
  try {
    // Перевірка, чи користувач є адміністратором
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Access denied. Admin rights required.' });
    }
    
    // Додаткова перевірка в базі даних (опціонально)
    const user = await User.findByPk(req.user.id);
    
    if (!user || !user.is_admin) {
      return res.status(403).json({ message: 'Access denied. Admin rights required.' });
    }
    
    next();
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};