const express = require('express');
const {
    protect,
    restrictTo
} = require('@middlewares/authMiddleware.js');
const marketplaceController = require('@controllers/marketPlace/marketplaceController.js');

const router = express.Router();

// Shops
router.post("/create/shops", protect, restrictTo("admin", "seller", "buyer"), marketplaceController.createShop);
router.get("/get/shops", marketplaceController.getShops);
router.get("/get/shops/:id", marketplaceController.getShopById);
router.put("/edit/shops/:id", protect, restrictTo("seller"), marketplaceController.editShops);

// Products
router.post("/add/products", protect, restrictTo("admin", "seller", "buyer"), marketplaceController.createProduct);
router.get("/get/products/shop/:shop_id", marketplaceController.getProductsByShop);
router.get('/get/all/products', marketplaceController.getAllProduct);
router.get('/get/products/:productId', marketplaceController.getProduct);

// Orders
router.post("/place/orders", protect, restrictTo("member", "buyer"), marketplaceController.createOrder);
router.get("/get/orders", protect, restrictTo("member", "buyer"), marketplaceController.getOrdersByBuyer);
router.get("/get/orders/:orderId", protect, restrictTo("member", "buyer"), marketplaceController.getoRdersById);
router.get(
    "/get/orders/shop/:shop_id",
    protect,
    restrictTo("seller"),
    marketplaceController.getOrdersByShop
);
router.get('/get/seller/details', protect, restrictTo('admin'), marketplaceController.getSellerDetails);

module.exports = router;