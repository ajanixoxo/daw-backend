const Shop = require("@models/marketPlace/shopModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Order = require("@models/marketPlace/orderModel.js");
const OrderItem = require("@models/marketPlace/orderItemModel.js");
const ShopView = require("@models/marketPlace/shopViewModel.js");
const User = require("@models/userModel/user.js");
const AppError = require("@utils/Error/AppError.js");
const { convertPrice } = require("@utils/currency/currencyHandler.js");
const Payment = require("@models/paymentModel/payment.model.js");
const { deliveryAssignedEmailTemplate } = require("@utils/EmailTemplate/template.js");
const mongoose = require("mongoose");
const { error } = require("winston");

// SHOP — one shop per user (business rule)
const createShop = async (data) => {
  const existing = await Shop.findOne({ owner_id: data.owner_id });
  if (existing) {
    throw new AppError("User already has a shop", 400);
  }
  return Shop.create(data);
};
const getShops = async () => {
  const shops = await Shop.find().lean();
  if (shops.length === 0) return [];

  const shopIds = shops.map((s) => s._id);
  const counts = await Product.aggregate([
    { $match: { shop_id: { $in: shopIds } } },
    { $group: { _id: "$shop_id", count: { $sum: 1 } } },
  ]);

  const countMap = {};
  counts.forEach((c) => { countMap[c._id.toString()] = c.count; });

  return shops.map((shop) => ({
    ...shop,
    productCount: countMap[shop._id.toString()] || 0,
  }));
};
const getShopById = async (id) => {
  return await Shop.findById(id);
};

const getShopByOwnerId = async (ownerId) => {
  return await Shop.findOne({ owner_id: ownerId });
};

const editShop = async ({ shopId, ownerId, data }) => {
  const allowedFields = [
    "name",
    "description",
    "category",
    "logo_url",
    "banner_url",
    "contact_number",
    "business_address"
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
    owner_id: ownerId
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
const createProduct = async ({ sellerId, shopId, name, quantity, weight, location, price, category, description, images, status, variants, productFeatures, careInstruction, returnPolicy }) => {
  const shop = await Shop.findOne({
    _id: shopId,
    owner_id: sellerId,
    status: "active"
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

  // Fetch seller's currency preference or default by country
  const seller = await User.findById(sellerId);
  const sellerCurrency = seller?.country === "Nigeria" ? "NGN" : "USD";

  return await Product.create({
    shop_id: shopId,
    name,
    quantity: Number(quantity),
    weight: Number(weight),
    location,
    price: Number(price),
    currency: sellerCurrency,
    category,
    description,
    images: images || [],
    status: status || "available",
    variants: variants || [],
    productFeatures: productFeatures || "",
    careInstruction: careInstruction || "",
    returnPolicy: returnPolicy || ""
  });
};

const getProductsByShop = async (shop_id, reqUser) => {
  const products = await Product.find({ shop_id }).populate("shop_id", "name").lean();
  const userCurrency = reqUser?.country === "Nigeria" ? "NGN" : "USD";

  return products.map(product => ({
    ...product,
    shop_name: product.shop_id?.name || "",
    shop_id: product.shop_id?._id || product.shop_id,
    displayPrice: convertPrice(product.price, product.currency || "NGN", userCurrency),
    displayCurrency: userCurrency
  }));
};

const editProduct = async ({ sellerId, productId, updates }) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const shop = await Shop.findOne({
    _id: product.shop_id,
    owner_id: sellerId,
    status: "active"
  });

  if (!shop) {
    throw new AppError("Unauthorized or inactive shop", 403);
  }

  const allowedFields = [
    "name", "description", "category", "quantity", "price",
    "images", "status", "variants", "productFeatures",
    "careInstruction", "returnPolicy"
  ];

  const filteredUpdates = {};
  for (const key of Object.keys(updates)) {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      filteredUpdates[key] = updates[key];
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    throw new AppError("No valid fields provided", 400);
  }

  // If renaming, check for duplicates (exclude self)
  if (filteredUpdates.name) {
    const duplicate = await Product.findOne({
      shop_id: product.shop_id,
      _id: { $ne: productId },
      name: { $regex: `^${filteredUpdates.name}$`, $options: "i" }
    });
    if (duplicate) {
      throw new AppError("Another product with this name already exists", 409);
    }
  }

  Object.assign(product, filteredUpdates);
  return await product.save();
};

const deleteProduct = async ({ sellerId, productId }) => {
  const product = await Product.findById(productId);
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const shop = await Shop.findOne({
    _id: product.shop_id,
    owner_id: sellerId
  });

  if (!shop) {
    throw new AppError("Unauthorized to delete this product", 403);
  }

  await Product.findByIdAndDelete(productId);
  return { message: "Product deleted successfully" };
};

// ORDER
const createOrder = async (buyer_id, items) => {
  try {
    if (!items || items.length === 0) {
      throw new AppError("No items provided", 400);
    }

    // 1. Group items by shop_id
    const shopGroups = {};
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        throw new AppError("Invalid item data", 400);
      }

      const product = await Product.findById(item.product_id);
      if (!product) {
        throw new AppError(`Product ${item.product_id} not found`, 404);
      }

      if (product.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }

      const shopId = product.shop_id.toString();
      if (!shopGroups[shopId]) {
        shopGroups[shopId] = {
          shop_id: shopId,
          items: [],
          total_amount: 0
        };
      }

      const subtotal = product.price * item.quantity;
      shopGroups[shopId].total_amount += subtotal;
      shopGroups[shopId].items.push({
        product,
        quantity: item.quantity,
        price: product.price
      });
    }

    const createdOrders = [];
    const allCreatedItems = [];

    // 2. Create an order for each shop group
    for (const shopId of Object.keys(shopGroups)) {
      const group = shopGroups[shopId];

      const order = await Order.create({
        buyer_id,
        shop_id: group.shop_id,
        total_amount: group.total_amount,
        status: "pending",
        payment_status: "unpaid",
        escrow_status: "pending"
      });

      const orderItemsToCreate = group.items.map(item => ({
        order_id: order._id,
        product_id: item.product._id,
        price: item.price,
        quantity: item.quantity
      }));

      const createdItems = await OrderItem.insertMany(orderItemsToCreate);

      // Decrement stock for each product
      for (const item of group.items) {
        item.product.quantity -= item.quantity;
        await item.product.save();
      }

      // Broadcasting logistics assignment (internal service)
      // Removed individual auto-assignment at order creation

      createdOrders.push(order);
      allCreatedItems.push(...createdItems);
    }

    return {
      orders: createdOrders,
      orderItems: allCreatedItems,
      // For backward compatibility with controllers expecting single objects
      order: createdOrders[0],
      orderId: createdOrders[0]._id
    };

  } catch (error) {
    console.error("Error in createOrder:", error.message);
    throw error;
  }
};


const getOrdersByBuyer = async (buyer_id) => {
  const orders = await Order.find({ buyer_id })
    .populate("shop_id")
    .sort({ createdAt: -1 })
    .lean();

  for (const order of orders) {
    const items = await OrderItem.find({ order_id: order._id })
      .populate({
        path: "product_id",
        select: "name description price images category"
      })
      .lean();

    order.items = items.map(item => ({
      _id: item._id,
      product_id: item.product_id?._id || null,
      product_name: item.product_id?.name || "Deleted Product",
      product_description: item.product_id?.description || "",
      product_image: item.product_id?.images?.[0] || "",
      product_category: item.product_id?.category || "",
      price_at_purchase: item.price,
      current_price: item.product_id?.price || item.price,
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    }));
  }
  return orders;
};

const getOrdersById = async (orderId) => {
  const order = await Order.findById(orderId).populate("shop_id").lean();
  if (!order) return null;

  const items = await OrderItem.find({ order_id: order._id })
    .populate({
      path: "product_id",
      select: "name description price images category"
    })
    .lean();

  order.items = items.map(item => ({
    _id: item._id,
    product_id: item.product_id?._id || null,
    product_name: item.product_id?.name || "Deleted Product",
    product_description: item.product_id?.description || "",
    product_image: item.product_id?.images?.[0] || "",
    product_category: item.product_id?.category || "",
    price_at_purchase: item.price,
    current_price: item.product_id?.price || item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity
  }));

  return order;
};

// PRODUCTS
async function getAllProduct(reqUser) {
  try {
    const products = await Product.find()
      .populate({
        path: "shop_id",
        select: "name owner_id logo_url",
        populate: {
          path: "owner_id",
          select: "firstName lastName email"
        }
      })
      .lean();

    const userCurrency = reqUser?.country === "Nigeria" ? "NGN" : "USD";

    return products.map(product => ({
      ...product,
      shop_name: product.shop_id?.name || "",
      shop_logo: product.shop_id?.logo_url || "",
      seller_name: product.shop_id?.owner_id ? `${product.shop_id.owner_id.firstName} ${product.shop_id.owner_id.lastName}` : "Unknown",
      seller_email: product.shop_id?.owner_id?.email || "",
      shop_id: product.shop_id?._id || product.shop_id,
      displayPrice: convertPrice(product.price, product.currency || "NGN", userCurrency),
      displayCurrency: userCurrency
    }));
  } catch (error) {
    return error;
  }
}

const getProductById = async (productId, reqUser) => {
  try {
    const product = await Product.findById(productId).populate("shop_id", "name").lean();
    if (!product) return null;

    const userCurrency = reqUser?.country === "Nigeria" ? "NGN" : "USD";

    return {
      ...product,
      shop_name: product.shop_id?.name || "",
      shop_id: product.shop_id?._id || product.shop_id,
      displayPrice: convertPrice(product.price, product.currency || "NGN", userCurrency),
      displayCurrency: userCurrency
    };
  } catch (error) {
    return error;
  }
};

const getOrdersByShopId = async (shop_id) => {
  const orders = await Order.find({ shop_id })
    .populate("buyer_id", "firstName lastName email phone")
    .populate("shop_id")
    .sort({ createdAt: -1 })
    .lean();

  for (const order of orders) {
    const items = await OrderItem.find({ order_id: order._id })
      .populate({
        path: "product_id",
        select: "name description price images category"
      })
      .lean();

    order.items = items.map(item => ({
      _id: item._id,
      product_id: item.product_id._id,
      product_name: item.product_id.name,
      product_description: item.product_id.description,
      product_image: item.product_id.images?.[0] || "",
      product_category: item.product_id.category,
      price_at_purchase: item.price, 
      current_price: item.product_id.price, 
      quantity: item.quantity,
      subtotal: item.price * item.quantity
    }));
  }

  return orders;
};

// SHOP VIEWS
const recordShopView = async (shopId, viewerId, ipAddress) => {
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

  // For logged-in users: deduplicate by user ID (ignore IP — it can vary)
  // For guests: deduplicate by IP address
  const filter = viewerId
    ? { shop_id: shopId, viewer_id: viewerId, view_date: today }
    : { shop_id: shopId, viewer_id: null, ip_address: ipAddress, view_date: today };

  // Atomic upsert — even simultaneous requests only create one document
  return ShopView.findOneAndUpdate(
    filter,
    { $setOnInsert: { shop_id: shopId, viewer_id: viewerId || null, ip_address: ipAddress, view_date: today } },
    { upsert: true, new: true }
  );
};

const getShopViewCount = async (shopId) => {
  return ShopView.countDocuments({ shop_id: shopId });
};

const assignAndNotifyLogistics = async (orderId) => {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;

    // 1. Try to sync shipping details from Payment record if not already set
    if (!order.shipping_address?.street || !order.delivery_fee) {
      // Payment orderId can be a single ID or a comma-separated list
      const payment = await Payment.findOne({
        orderId: { $regex: orderId.toString() }
      });

      if (payment) {
        if (!order.delivery_fee) {
          order.delivery_fee = payment.charge || 0; // Use charge as delivery fee if not set
        }
        
        if (!order.shipping_address?.street) {
          order.shipping_address = {
            street: payment.address?.[0] || payment.DeliveryAddress,
            city: payment.city,
            state: payment.state,
            country: payment.country,
            zipCode: payment.zipCode
          };
        }
        await order.save();
      }
    }

    // 2. Broadcast notification to all active logistics providers (Users with logistics_provider role)
    const providers = await User.find({ roles: { $in: ["logistics_provider"] }, status: "active" });

    if (providers.length > 0) {
      const notificationPromises = providers.map(user => {
        if (user.email) {
          return deliveryAssignedEmailTemplate(
            user.email,
            user.firstName || "Logistics Team",
            order._id.toString()
          ).catch(err => console.error(`Failed to send delivery email to ${user.email}:`, err.message));
        }
        return Promise.resolve();
      });

      await Promise.all(notificationPromises);
      console.log(`Logistics broadcast notification sent to ${providers.length} providers for order ${orderId}`);
    } else {
      console.warn(`No active logistics providers found to notify for order ${orderId}`);
    }
  } catch (error) {
    console.error("Error in assignAndNotifyLogistics:", error.message);
  }
};

const getOrderStatus = async(orderId) => {
 try {
    const orderStatus = await Order.findById(orderId);
    // console.log("orderStatus", orderStatus);

    if(!orderStatus){
      throw new AppError("Order not available", 400);
    }

    return orderStatus;
 } catch (error) {
    console.log("Error in finding order", error.message);
    throw error;
 }
}

module.exports = {
  createShop,
  getShops,
  getShopById,
  getShopByOwnerId,
  editShop,
  createProduct,
  editProduct,
  deleteProduct,
  getProductsByShop,
  createOrder,
  getOrdersByBuyer,
  getOrdersById,
  getAllProduct,
  getProductById,
  getOrdersByShopId,
  recordShopView,
  getShopViewCount,
  assignAndNotifyLogistics,
  getOrderStatus
};