/**
 * Simple currency conversion utility.
 * In a production environment, this should fetch live rates from an API.
 */

const EXCHANGE_RATE = 1500; // 1 USD = 1500 NGN

/**
 * Converts price between NGN and USD.
 * @param {number} price - Original price.
 * @param {string} fromCurrency - Original currency ('NGN' or 'USD').
 * @param {string} toCurrency - Target currency ('NGN' or 'USD').
 * @returns {number} - Converted price.
 */
const convertPrice = (price, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) {
    return price;
  }

  if (fromCurrency === "USD" && toCurrency === "NGN") {
    return price * EXCHANGE_RATE;
  }

  if (fromCurrency === "NGN" && toCurrency === "USD") {
    return price / EXCHANGE_RATE;
  }

  return price;
};

/**
 * Gets currency symbol based on currency code.
 * @param {string} currency - 'NGN' or 'USD'.
 * @returns {string} - '₦' or '$'.
 */
const getCurrencySymbol = (currency) => {
  return currency === "NGN" ? "₦" : "$";
};

module.exports = {
  convertPrice,
  getCurrencySymbol,
  EXCHANGE_RATE
};
