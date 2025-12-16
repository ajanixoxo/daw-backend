const axios = require("axios");

let cachedToken = null;
let tokenExpiryTime = null;

const loginAndGetToken = async () => {
  if (cachedToken && tokenExpiryTime > Date.now()) {
    return cachedToken;
  }

  const response = await axios.post(
    `${process.env.VIGIPAY_CUSTOMER_BASE_URL}/api/Auth/getToken`,
    {
      userName: process.env.VIGIPAY_USERNAME,
      password: process.env.VIGIPAY_PASSWORD,
    }
  );

  const token = response.data.responseData.token;

  
  cachedToken = token;
  tokenExpiryTime = Date.now() + 50 * 60 * 1000;

  return token;
};

module.exports = { loginAndGetToken };
