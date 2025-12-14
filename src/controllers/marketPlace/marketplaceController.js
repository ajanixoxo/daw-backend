const asyncHandler = require('express-async-handler');
// import * as marketplaceService from "@services/marketplaceService.js";
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js")
const AppError = require('@utils/Error/AppError.js');
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");

// Create a new shop
const createShop = asyncHandler(async (req, res) => {
  console.log("🔥 createShop controller HIT");

  // Ensure user is authenticated
  if (!req.user || !req.user._id) {
    throw new AppError('User not authenticated', 401);
  }

  const { name, description, category, logo_url, banner_url, is_member_shop, cooperative_id } = req.body;

  const owner_id = req.user._id;

  // Get user to check roles and upgrade if needed
  const foundUser = await User.findById(owner_id);
  if (!foundUser) {
    throw new AppError('User not found', 404);
  }

  // Get current roles array
  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];

  // If user has "buyer" role, automatically upgrade to "seller"
  if (currentRoles.includes('buyer') && !currentRoles.includes('seller')) {
    currentRoles.push('seller');
    foundUser.roles = currentRoles;
    await foundUser.save();
  }

  const shopData = {
    owner_id,
    cooperative_id: cooperative_id || null,
    name,
    description,
    category,
    logo_url,
    banner_url,
    is_member_shop: !!is_member_shop,
    status: "active",
  };

  const shop = await marketplaceService.createShop(shopData);
  if (!shop) {
    return res.status(400).json({
      message: "Shop not created"
    })
  }
  res.status(201).json({ success: true, shop });
});

// Get all shops
const getShops = asyncHandler(async (req, res) => {
  const shops = await marketplaceService.getShops();
  res.status(200).json({ success: true, shops });
});

// Get single shop by ID
const getShopById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shop = await marketplaceService.getShopById(id);
  if (!shop) return res.status(404).json({ message: "Shop not found" });
  res.status(200).json({ success: true, shop });
});

// Create a product (seller/admin)
const createProduct = asyncHandler(async (req, res) => {
  const { shop_id } = req.body;

  if (!shop_id) {
    throw new AppError("Shop ID is required", 400);
  }

  if (!req.user.shop) {
    throw new AppError("Seller does not have a shop", 400);
  }

  const product = await marketplaceService.createProduct({
    sellerId: req.user._id,
    shopId: shop_id,
    ...req.body
  });

  if (!product) {
    return res.status(400).json({
      message: "Product not created"
    })
  }

  res.status(201).json({ success: true, product });
});


const getProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const productView = await marketplaceService.getProductById(productId);
    if (!productView) {
      return res.status(404).json({
        message: 'product not found'
      })
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      product: productView
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error while fetching product",
      error: error.message
    });
  }
}
// Get products by shop
const getProductsByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;
  const products = await marketplaceService.getProductsByShop(shop_id);
  res.status(200).json({ success: true, products });
});

// Place an order (buyer)
const createOrder = asyncHandler(async (req, res) => {
  const { items, shop_id } = req.body;
  const buyer_id = req.user._id;

  if (!items || items.length === 0) {
    throw new AppError("Order items are required", 400);
  }

  const { order, orderItems } =
    await marketplaceService.createOrder(buyer_id, shop_id, items);

  res.status(201).json({
    success: true,
    order,
    orderItems,
  });
});


// Get orders by buyer
const getOrdersByBuyer = asyncHandler(async (req, res) => {
  const buyer_id = req.user._id;
  const orders = await marketplaceService.getOrdersByBuyer(buyer_id);
  res.status(200).json({ success: true, orders });
});

const getoRdersById = asyncHandler(async (req, res) => {
  const buyer_id = req.user._id;
  const { orderId } = req.params;
  const order = await marketplaceService.getOrdersById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  res.status(200).json({ success: true, order });
});

const getAllProduct = asyncHandler(async (req, res) => {
  try {
    const products = await marketplaceService.getAllProduct();
    if (!products) {
      return res.status(400).json({
        message: "No products available"
      })
    }

    return res.status(200).json({
      message: "Fetched all the products",
      products: products
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error during fetching the products",
      error: error.message
    })
  }
});

const getOrdersByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;
  const shop = await Shop.findById(shop_id);

  if (!shop) {
    return res.status(404).json({
      success: false,
      message: "Shop not found",
    });
  }

  if (
    !shop ||
    (req.user.roles.includes("seller") &&
      shop.owner_id.toString() !== req.user._id.toString())
  ) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to view orders for this shop",
    });
  }
  const orders = await marketplaceService.getOrdersByShopId(shop_id);

  if (!orders || orders.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No orders found for this shop",
    });
  }

  res.status(200).json({
    success: true,
    orders,
  });
});


module.exports = {
  createShop,
  getShops,
  getShopById,
  createProduct,
  getOrdersByShop,
  getProductsByShop,
  createOrder,
  getOrdersByBuyer,
  getoRdersById,
  getAllProduct,
  getProduct
}