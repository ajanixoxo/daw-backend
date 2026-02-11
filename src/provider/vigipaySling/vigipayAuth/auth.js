const axios = require("axios");

let cachedToken = null;
let tokenExpiryTime = null;

const loginAndGetToken = async () => {
  try {
    if (cachedToken && tokenExpiryTime > Date.now()) {
      return cachedToken;
    }

    const response = await axios.post(
      `${process.env.VIGIPAY_CUSTOMER_BASE_URL}/api/Auth/getToken`,
      {
        userName: process.env.VIGIPAY_USERNAME,
        password: process.env.VIGIPAY_PASSWORD,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "FULL AUTH RESPONSE:",
      JSON.stringify(response.data, null, 2)
    );

    // ✅ CORRECT TOKEN PATH
    const token = response.data?.responseData?.access_token;

    if (!token) {
      throw new Error("Token not found in auth response");
    }

    cachedToken = token;
    tokenExpiryTime = Date.now() + 55 * 60 * 1000; // use expires_in if you want

    return token;
  } catch (err) {
    console.error(
      "VigiPay Auth Failed:",
      err.response?.data || err.message
    );
    return null;
  }
};

module.exports = { loginAndGetToken };
