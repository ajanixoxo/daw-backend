const express = require("express");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");
const controller = require("@controllers/marketPlace/marketplaceExtraController.js");

const router = express.Router();

// stock
router.get("/stock/:product_id", controller.getStock);
router.put("/stock", protect, restrictTo("admin"), controller.updateStock); // for admin only

// wishlist 
router.post("/wishlist", protect, controller.addToWishlist);
router.delete("/remove/wishlist", protect, controller.removeFromWishlist);
router.get("/wishlist", protect, controller.getWishlist);

// review or we can say feedback
router.post("/reviews", protect, controller.addReview);
router.get("/reviews/:product_id", controller.getReviews);

// cart 
router.post("/cart", protect, controller.createCart);
router.post("/cart/item", protect, controller.addItemToCart);
router.delete("/remove/cart/item", protect, controller.removeItemFromCart);
router.get("/cart/:cart_id", protect, controller.getCartItems);

module.exports = router;
