const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PATHS } = require("./constants");

class NovaPay {
  constructor() {
    this.baseUrl = "https://api-qecom.novapay.ua/v1";
  }

  buildUrl(action) {
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    return `${base}${PATHS[action]}`;
  }

   signRequest(data) {

    try {
      const privateKey = fs.readFileSync('private_key.pem', 'utf8');
      const publicKey = fs.readFileSync('public_key.pem', 'utf8');

        const sign = crypto.createSign("SHA1");
sign.update(JSON.stringify(data));
sign.end();

const signature = sign.sign(
    {
        key: privateKey,
        passphrase: "petrolcard",  // Замініть на свій пароль
    },
    "base64"
);

const verify = crypto.createVerify('RSA-SHA1'); // Same hashing algorithm used in signing
    verify.update(JSON.stringify(data));
    verify.end();

    // Verify the signature using the public key
    const isVerified = verify.verify(publicKey, signature, 'base64');
    console.log("Verification result:", isVerified ? 'Signature is valid' : 'Signature is invalid');

    return signature

    } catch (error) {
        console.error("Помилка підписування запиту:", error);
        throw error;
    }
}

  async skeletonPost(action, body) {
    try {
      const url = this.buildUrl(action);
      const requestData = typeof body === "string" ? JSON.parse(body) : body;
      
      const signature = this.signRequest(requestData);

      console.log(`Виконуємо запит до: ${url}`);
      console.log("Тіло запиту:", JSON.stringify(requestData, null, 2));
      console.log("Підпис запиту:", signature);

      const response = await axios.post(url, requestData, {
        headers: {
          "Content-Type": "application/json",
          "x-sign": signature,
        },
        timeout: 15000,
      });

      console.log("Відповідь від API:", response.data);
      return response;
    } catch (error) {
      console.error("Помилка запиту до NovaPay:", error.message);
      if (error.response) {
        console.error("Статус відповіді:", error.response.status);
        console.error("Відповідь API:", error.response.data);
      }
      throw error.response;
    }
  }

  async createSession(merchant_id, client_phone) {
    console.log(`Створюємо сесію для мерчанта ${merchant_id} та телефону ${client_phone}`);
    return this.skeletonPost("createSession", {
      merchant_id: merchant_id,
      client_phone: client_phone,
    });
  }

  async addPayment(merchant_id, session_id, amount) {
    return this.skeletonPost(
      "addPayment",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
        amount: amount,
      })
    );
  }

  async addPaymentWithDeliveryParam(merchant_id, session_id, amount, delivery) {
    return this.skeletonPost(
      "addPayment",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
        amount: amount,
        delivery: delivery,
      })
    );
  }

  async addPaymentWithProductsParam(merchant_id, session_id, amount, products) {
    return this.skeletonPost(
      "addPayment",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
        amount: amount,
        products: products,
      })
    );
  }

  async addPaymentWithAllParams(merchant_id, session_id, amount, delivery, products) {
    return this.skeletonPost(
      "addPayment",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
        amount: amount,
        delivery: delivery,
        products: products,
      })
    );
  }

  async voidSession(merchant_id, session_id) {
    return this.skeletonPost(
      "voidSession",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
      })
    );
  }

  async completeHold(merchant_id, session_id) {
    return this.skeletonPost(
      "completeHold",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
      })
    );
  }

  async completeHoldWithOperationsParam(merchant_id, session_id, operations) {
    return this.skeletonPost(
      "completeHold",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
        operations: operations,
      })
    );
  }

  async expireSession(merchant_id, session_id) {
    return this.skeletonPost(
      "expireSession",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
      })
    );
  }

  async confirmDeliveryHold(merchant_id, session_id) {
    return this.skeletonPost(
      "confirmDeliveryHold",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
      })
    );
  }

  async printExpressWaybill(merchant_id, session_id) {
    return this.skeletonPost(
      "printExpressWaybill",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
      })
    );
  }

  async getStatus(merchant_id, session_id) {
    return this.skeletonPost(
      "getStatus",
      JSON.stringify({
        merchant_id: merchant_id,
        session_id: session_id,
      })
    );
  }

  async deliveryInfo(merchant_id) {
    return this.skeletonPost(
      "deliveryInfo",
      JSON.stringify({
        merchant_id: merchant_id,
      })
    );
  }

  async deliveryPrice(merchant_id, recipient_city, recipient_warehouse, volume_weight, weight, amount) {
    return this.skeletonPost(
      "deliveryPrice",
      JSON.stringify({
        merchant_id: merchant_id,
        recipient_city: recipient_city,
        recipient_warehouse: recipient_warehouse,
        volume_weight: volume_weight,
        weight: weight,
        amount: amount,
      })
    );
  }
}

module.exports = NovaPay;