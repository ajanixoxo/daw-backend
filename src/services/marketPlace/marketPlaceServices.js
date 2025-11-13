const Shop = require('@models/marketPlace/shopModel.js');
const Product = require('@models/marketPlace/productModel.js');
const Order = require('@models/marketPlace/orderModel.js');
const OrderItem = require('@models/marketPlace/orderItemModel.js');


 const createShop = async (data) => await Shop.create(data);
 const getShops = async () => await Shop.find();
 const getShopById = async (id) => await Shop.findById(id);

 const createProduct = async (data) => await Product.create(data);
 const getProductsByShop = async (shop_id) =>
  await Product.find({ shop_id });

 const createOrder = async (orderData, items) => {
  const order = await Order.create(orderData);
  const orderItems = items.map((i) => ({
    ...i,
    order_id: order._id,
  }));
  await OrderItem.insertMany(orderItems);
  return { order, orderItems };
};

 const getOrdersByBuyer = async (buyer_id) =>
  await Order.find({ buyer_id }).populate("shop_id");

 const getOrdersById = async(orderId) => {
   return await Order.findById(orderId).populate("shop_id")
 }

 module.exports = {
  createShop,
  getShops,
  getShopById,
  createProduct,
  getProductsByShop,
  createOrder,
  getOrdersByBuyer,
  getOrdersById
}