const express = require('express');
const router = express.Router();
const controller = require('@controllers/marketPlace/marketplaceExtraController.js');
const { protect, restrictTo } = require("@middlewares/authMiddleware.js"); 

router.get('/stock/:product_id', controller.getStock);
router.put('/stock', protect, restrictTo("admin", "seller"), controller.updateStock);

router.route('/wishlist')
  .get(protect, controller.getWishlist)
  .post(protect, controller.addToWishlist)
  .delete(protect, controller.clearWishlist);

router.delete('/wishlist/:product_id', protect, controller.removeFromWishlist);

router.route('/reviews')
  .post(protect, controller.addReview);

router.route('/reviews/:product_id')
  .get(controller.getReviews); 

router.delete('/reviews/:review_id', protect, controller.deleteReview);

router.route('/cart')
  .get(protect, controller.getCartItems)
  .post(protect, controller.addItemToCart)
  .delete(protect, controller.clearCart);

router.post('/cart/validate', protect, controller.validateCart);

router.route('/cart/:cart_item_id')
  .put(protect, controller.updateCartItem)
  .delete(protect, controller.removeItemFromCart);

module.exports = router;