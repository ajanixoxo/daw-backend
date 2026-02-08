const Shop = require("@models/marketPlace/shopModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Order = require("@models/marketPlace/orderModel.js");
const OrderItem = require("@models/marketPlace/orderItemModel.js");
const AppError = require("@utils/Error/AppError.js");
const mongoose = require("mongoose");

// SHOP — one shop per user (business rule)
const createShop = async (data) => {
  const existing = await Shop.findOne({ owner_id: data.owner_id });
  if (existing) {
    throw new AppError("User already has a shop", 400);
  }
  return Shop.create(data);
};
const getShops = async () => await Shop.find();
const getShopById = async (id) =>{ 
  await Shop.findById(id);

}

const editShop = async ({ shopId, ownerId, data }) => {
  const allowedFields = [
    "name",
    "description",
    "store_url",
    "category",
    "logo_url",
    "banner_url",
  ];

  const filteredData = {};
  Object.keys(data).forEach((key) => {
    if (allowedFields.includes(key) && data[key] !== undefined) {
      filteredData[key] = data[key];
    }
  });

  if (Object.keys(filteredData).length === 0) {
    throw new AppError("No valid fields provided", 400);
  }

  const shop = await Shop.findOne({
    _id: shopId,
    owner_id: ownerId,
  });

  if (!shop) {
    throw new AppError("Shop not found or unauthorized", 404);
  }

  if (shop.status !== "active") {
    throw new AppError("Cannot edit inactive shop", 403);
  }

  Object.assign(shop, filteredData);
  return await shop.save();
};


// PRODUCT
const createProduct = async ({ sellerId, shopId, name, quantity, price, category, description }) => {
  const shop = await Shop.findOne({
    _id: shopId,
    owner_id: sellerId,
    status: "active",
  });

  if (!shop) {
    throw new AppError("Invalid or inactive shop", 403);
  }

  if (price <= 0) {
    throw new AppError("Price must be greater than zero", 400);
  }

  if (quantity < 0) {
    throw new AppError("Quantity cannot be negative", 400);
  }

  const existingProduct = await Product.findOne({
    shop_id: shopId,
    name: { $regex: `^${name}$`, $options: "i" },
  });

  if (existingProduct) {
    throw new AppError("Product already exists in this shop", 409);
  }

  return await Product.create({
    shop_id: shopId,
    name,
    quantity,
    price,
    category,
    description,
  });
};

const getProductsByShop = async (shop_id) => await Product.find({ shop_id });

// ORDER
const createOrder = async (buyer_id, items) => {
  try {
    let total_amount = 0;
    const orderItems = [];
    const updatedProducts = [];
    let derivedShopId = null;

    console.log("Starting order creation...");

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        throw new AppError("Invalid item data", 400);
      }

      const product = await Product.findById(item.product_id);
      if (!product) throw new AppError("Product not found", 404);

      // 🔹 Derive shop_id from first product
      if (index === 0) {
        derivedShopId = product.shop_id;
      }

      // 🔹 Ensure all products belong to same shop
      if (product.shop_id.toString() !== derivedShopId.toString()) {
        throw new AppError("All products must belong to the same shop", 400);
      }

      if (product.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }

      if (!product.price || product.price <= 0) {
        throw new AppError(`Invalid price for ${product.name}`, 400);
      }

      const subtotal = product.price * item.quantity;
      total_amount += subtotal;

      orderItems.push({
        product_id: product._id,
        price: product.price,
        quantity: item.quantity,
      });

      const originalQuantity = product.quantity;
      product.quantity -= item.quantity;
      await product.save();

      updatedProducts.push({ product, originalQuantity });
    }

    if (total_amount <= 0) {
      for (const { product, originalQuantity } of updatedProducts) {
        product.quantity = originalQuantity;
        await product.save();
      }
      throw new AppError("Invalid total amount", 400);
    }

    const order = await Order.create({
      buyer_id,
      shop_id: derivedShopId,  
      total_amount,
      status: "pending",
      payment_status: "unpaid",
      escrow_status: "pending",
    });

    const finalItems = orderItems.map(i => ({
      ...i,
      order_id: order._id,
    }));

    const createdItems = await OrderItem.insertMany(finalItems);

    return { order, orderItems: createdItems };

  } catch (error) {
    console.error("Error in createOrder:", error.message);
    throw error;
  }
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

const getProductById = async (productId) => {
  try {
    return await Product.findById(productId);
  } catch (error) {
    return res.status(500).json({
      message: "Error while fetching product",
      error: error.message,
    });
  }
};

const getOrdersByShopId = async (shop_id) => {
 const orders = await Order.find({ shop_id })
    .populate("buyer_id", "firstName lastName email phone")
    .populate("shop_id")
    .sort({ createdAt: -1 })
    .lean();

  for (let order of orders) {
    const items = await OrderItem.find({ order_id: order._id })
      .populate({
        path: "product_id",
        select: "name description price image_url category"
      })
      .lean();

    order.items = items.map(item => ({
      _id: item._id,
      product_id: item.product_id._id,
      product_name: item.product_id.name,
      product_description: item.product_id.description,
      product_image: item.product_id.image_url,
      product_category: item.product_id.category,
      price_at_purchase: item.price, 
      current_price: item.product_id.price, 
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    }));
  }

  return orders;
};

module.exports = {
  createShop,
  getShops,
  getShopById,
  editShop,
  createProduct,
  getProductsByShop,
  createOrder,
  getOrdersByBuyer,
  getOrdersById,
  getAllProduct,
  getProductById,
  getOrdersByShopId,
};