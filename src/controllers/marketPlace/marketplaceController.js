const asyncHandler = require('express-async-handler');
// import * as marketplaceService from "@services/marketplaceService.js";
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js")

// Create a new shop
const createShop = asyncHandler(async (req, res) => {
  const { name, description, category, logo_url, banner_url, is_member_shop, cooperative_id } = req.body;

  const owner_id = req.user._id;

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
  const { shop_id, name, quantity, price } = req.body;

  const product = await marketplaceService.createProduct({
    shop_id,
    name,
    quantity,
    price,
  });

  res.status(201).json({ success: true, product });
});

// Get products by shop
const getProductsByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;
  const products = await marketplaceService.getProductsByShop(shop_id);
  res.status(200).json({ success: true, products });
});

// Place an order (buyer)
const createOrder = asyncHandler(async (req, res) => {
  const { items, total_amount, shop_id } = req.body;
  const buyer_id = req.user._id;

  const orderData = {
    buyer_id,
    shop_id,
    total_amount,
    status: "pending",
    payment_status: "unpaid",
    escrow_status: "pending",
  };

  const { order, orderItems } = await marketplaceService.createOrder(orderData, items);
  res.status(201).json({ success: true, order, orderItems });
});

// Get orders by buyer
const getOrdersByBuyer = asyncHandler(async (req, res) => {
  const buyer_id = req.user._id;
  const orders = await marketplaceService.getOrdersByBuyer(buyer_id);
  res.status(200).json({ success: true, orders });
});

const getoRdersById = asyncHandler(async(req,res) => {
   const buyer_id = req.user._id;
   const { orderId } = req.params;
    const order = await marketplaceService.getOrdersById(orderId);

    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
});

const getAllProduct = asyncHandler(async(req,res) => {
    try{
      const products = await marketplaceService.getAllProduct();
      if(!products){
        return res.status(400).json({
          message:"No products available"
        })
      }

      return res.status(200).json({
        message:"Fetched all the products",
        products: products
      });

    }catch(error){
      return res.status(500).json({
        message:"Error during fetching the products",
        error: error.message
      })
    }
});

module.exports = {
    createShop,
    getShops,
    getShopById,
    createProduct,
    getProductsByShop,
    createOrder,
    getOrdersByBuyer,
    getoRdersById,
    getAllProduct
}