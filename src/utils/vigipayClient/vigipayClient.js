const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { loginAndGetToken } = require("../../provider/vigipaySling/vigipayAuth.js/auth.js");

const vigipayClient = axios.create({
  baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL,

  headers: {
    "Content-Type": "application/json",
    ApiKey: process.env.VIGIPAY_INTEGRATION_KEY,
  },
  timeout: 20000,
});

vigipayClient.interceptors.request.use(async (config) => {
  const token = await loginAndGetToken();
  config.headers.Authorization = `Bearer ${token}`;
  // console.log("token", token, "added to headers", config.headers);
  return config;
});

module.exports = vigipayClient;
