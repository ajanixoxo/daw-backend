const Shop = require("@models/marketPlace/shopModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Order = require("@models/marketPlace/orderModel.js");
const OrderItem = require("@models/marketPlace/orderItemModel.js");

// SHOP
const createShop = async (data) => await Shop.create(data);
const getShops = async () => await Shop.find();
const getShopById = async (id) => await Shop.findById(id);

// PRODUCT
const createProduct = async (data) => await Product.create(data);
const getProductsByShop = async (shop_id) => await Product.find({ shop_id });

// ORDER
const createOrder = async (orderData, items) => {
  const order = await Order.create(orderData);

  const orderItems = items.map((i) => ({
    ...i,
    order_id: order._id,
  }));

  const createdItems = await OrderItem.insertMany(orderItems);

  return { order, orderItems: createdItems };
};

const getOrdersByBuyer = async (buyer_id) =>
  await Order.find({ buyer_id }).populate("shop_id");

const getOrdersById = async (orderId) => {
  return await Order.findById(orderId).populate("shop_id");
};

// PRODUCTS
async function getAllProduct() {
  try {
    return await Product.find();
  } catch (error) {
    return error;
  }
}

module.exports = {
  createShop,
  getShops,
  getShopById,
  createProduct,
  getProductsByShop,
  createOrder,
  getOrdersByBuyer,
  getOrdersById,
  getAllProduct,
};
