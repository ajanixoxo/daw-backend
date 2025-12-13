const asyncHandler = require("express-async-handler");
const marketplaceService = require("@services/marketPlace/marketPlaceEXtraServices.js");

// STOCK
const getStock = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  const stock = await marketplaceService.getStockByProduct(product_id);
  res.status(200).json({ success: true, stock });
});

// WISHLIST
const addToWishlist = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const user_id = req.user._id;
  const item = await marketplaceService.addToWishlist(user_id, product_id);
  if (!item) {
    return res
      .status(400)
      .json({ success: false, message: "Item can't be added in wishlist" });
  }
  res.status(201).json({ success: true, item });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  const user_id = req.user._id;
  const deleted = await marketplaceService.removeFromWishlist(
    user_id,
    product_id
  );

  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: "Wishlist item not found" });
  }

  res.status(200).json({ success: true, message: "Removed" });
});

const getWishlist = asyncHandler(async (req, res) => {
  const user_id = req.user._id;
  const items = await marketplaceService.getWishlist(user_id);
  res.status(200).json({ success: true, items });
});

// REVIEW
const addReview = asyncHandler(async (req, res) => {
  const { product_id, rating, comment } = req.body;
  const user_id = req.user._id;
  const review = await marketplaceService.addReview(
    user_id,
    product_id,
    rating,
    comment
  );
  res.status(201).json({ success: true, review });
});

const getReviews = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  const reviews = await marketplaceService.getReviews(product_id);
  res.status(200).json({ success: true, reviews });
});

// CART
const addItemToCart = asyncHandler(async (req, res) => {
  try {
    const user_id = req.user._id;
    const { product_id, quantity, price } = req.body;
    if (!product_id || !quantity || !price) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }
    const item = await marketplaceService.addItemToCart(
      user_id,
      product_id,
      quantity,
      price
    );
    res.status(201).json({ success: true, item });
  } catch (error) {
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

const removeItemFromCart = asyncHandler(async (req, res) => {
  const { cart_item_id } = req.body;
  await marketplaceService.removeItemFromCart(cart_item_id);
  res.status(200).json({ success: true, message: "Removed" });
});

const getCartItems = asyncHandler(async (req, res) => {
  const { cart_id } = req.params;
  const items = await marketplaceService.getCartItems(cart_id);
  res.status(200).json({ success: true, items });
});

//only admin can update stock
const updateStock = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;

  // Update stock using service
  const stock = await marketplaceService.updateStock(product_id, quantity);
  res.status(200).json({ success: true, stock });
});
module.exports = {
  getStock,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  addReview,
  getReviews,
  addItemToCart,
  removeItemFromCart,
  getCartItems,
  updateStock,
};
