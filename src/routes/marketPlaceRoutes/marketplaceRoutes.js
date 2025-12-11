const express = require('express');
const {
    protect,
    restrictTo
} = require('@middlewares/authMiddleware.js');
const marketplaceController = require('@controllers/marketPlace/marketplaceController.js')

const router = express.Router();

// Shops
router.post("/create/shops", protect, restrictTo("admin"), marketplaceController.createShop);
router.get("/get/shops", marketplaceController.getShops);
router.get("/get/shops/:id", marketplaceController.getShopById);

// Products
router.post("/add/products", protect, restrictTo("admin"), marketplaceController.createProduct);
router.get("/get/products/shop/:shop_id", marketplaceController.getProductsByShop);
router.get('/get/all/products', marketplaceController.getAllProduct);

// Orders
router.post("/place/orders", protect, restrictTo("member","buyer"), marketplaceController.createOrder);
router.get("/get/orders", protect, restrictTo("member"), marketplaceController.getOrdersByBuyer);
router.get("/get/orders/:orderId", protect, restrictTo("member"), marketplaceController.getoRdersById);


module.exports = router;
