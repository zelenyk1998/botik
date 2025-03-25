class SessionService {
    constructor() {
      this.sessions = {};
    }
  
    // Створення або оновлення сесії
    create(chatId, initialState = {}) {
      this.sessions[chatId] = {
        ...initialState,
        createdAt: new Date()
      };
      return this.sessions[chatId];
    }
  
    // Отримання сесії
    get(chatId) {
      return this.sessions[chatId] || null;
    }
  
    // Оновлення стану сесії
    update(chatId, newState) {
      if (!this.sessions[chatId]) {
        throw new Error('Сесія не існує');
      }
      this.sessions[chatId] = {
        ...this.sessions[chatId],
        ...newState
      };
      return this.sessions[chatId];
    }
  
    // Перевірка стану сесії
    checkState(chatId, expectedState) {
      const session = this.get(chatId);
      return session && session.state === expectedState;
    }
  
    // Видалення сесії
    delete(chatId) {
      delete this.sessions[chatId];
    }
  
    // Очищення застарілих сесій
    cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 години
      const now = new Date();
      Object.keys(this.sessions).forEach(chatId => {
        const sessionAge = now - this.sessions[chatId].createdAt;
        if (sessionAge > maxAge) {
          this.delete(chatId);
        }
      });
    }
  }
  
  module.exports = SessionService;