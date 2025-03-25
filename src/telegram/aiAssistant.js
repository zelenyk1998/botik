// aiAssistant.js
const axios = require('axios');
require('dotenv').config();

class AIAssistant {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.siteUrl = process.env.SITE_URL || 'https://petrolcard.biz';
    this.siteName = process.env.SITE_NAME || 'PetrolCardBot';
  }

  async generateResponse(prompt, options = {}) {
    try {
      console.log(`Generating AI response for prompt: ${prompt.substring(0, 50)}...`);
      
      const model = options.model || 'openai/gpt-4o';
      const maxTokens = options.maxTokens || 1000;
      const models = ['anthropic/claude-3.5-sonnet', 'google/gemma-2-9b-it:free'];
      
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: model,
          models: models,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: options.temperature || 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': this.siteUrl,
            'X-Title': this.siteName,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      } else {
        console.error('Unexpected API response structure:', response.data);
        throw new Error('Неочікувана відповідь від AI сервісу');
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      if (error.response) {
        console.error('API response error:', error.response.data);
        
        // Повертаємо інформативну помилку в залежності від статус-коду
        if (error.response.status === 401) {
          throw new Error('Помилка автентифікації в AI сервісі. Перевірте API ключ.');
        } else if (error.response.status === 429) {
          throw new Error('Перевищено ліміт запитів до AI сервісу. Спробуйте пізніше.');
        } else {
          throw new Error(`Помилка AI сервісу: ${error.response.status}`);
        }
      }
      
      throw new Error('Помилка при зверненні до AI сервісу');
    }
  }
  
  // Метод для обробки специфічних питань на українській мові
  async processUkrainianQuery(query, options = {}) {
    try {
      const systemPrompt = `Ти - AI асистент для бота з продажу паливних талонів в Україні. 
Відповідай українською мовою. Будь ввічливим, корисним та лаконічним. 
Відповідай на питання пов'язані з паливом, АЗС, автомобілями та їх обслуговуванням.
Якщо не знаєш відповіді на питання, запропонуй звернутися до служби підтримки. Не відповідай на питання, які порушують закони України. Не відповідай якщо тебе просять написати якийсь код для програмування. Ти суто асистент в авто тематиці та в тематиці АЗС.`;
const model = options.model || 'openai/gpt-4o';
const maxTokens = options.maxTokens || 1000;
const models = ['anthropic/claude-3.5-sonnet', 'google/gemma-2-9b-it:free'];
      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model: model,
          models: models,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': this.siteUrl,
            'X-Title': this.siteName,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('Неочікувана відповідь від AI сервісу');
      }
    } catch (error) {
      console.error('Error processing Ukrainian query:', error);
      throw error;
    }
  }
}

module.exports = AIAssistant;