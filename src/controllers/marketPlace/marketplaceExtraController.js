const asyncHandler = require("express-async-handler");
const marketplaceService = require("@services/marketPlace/marketPlaceExtraServices.js");
const AppError = require("@utils/Error/AppError.js");

const getStock = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  
  const stock = await marketplaceService.getStockByProduct(product_id);
  if(!stock) {
    throw new AppError("Stock information not found", 404);
  }
  res.status(200).json({ 
    success: true, 
    data: stock 
  });
});

const updateStock = asyncHandler(async (req, res) => {
  const { product_id, quantity, reason } = req.body;

  if (!product_id || quantity === undefined) {
    throw new AppError("Product ID and quantity are required", 400);
  }

  const stock = await marketplaceService.updateStock(
    product_id, 
    quantity, 
    req.user._id,
    reason
  );
  
  res.status(200).json({ 
    success: true, 
    message: "Stock updated successfully",
    data: stock 
  });
});


const addToWishlist = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  
  if (!product_id) {
    throw new AppError("Product ID is required", 400);
  }

  const user_id = req.user._id;
  const item = await marketplaceService.addToWishlist(user_id, product_id);
  
  res.status(201).json({ 
    success: true, 
    message: "Item added to wishlist",
    data: item 
  });
});


const removeFromWishlist = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  const user_id = req.user._id;
  
  await marketplaceService.removeFromWishlist(user_id, product_id);

  res.status(200).json({ 
    success: true, 
    message: "Item removed from wishlist" 
  });
});


const getWishlist = asyncHandler(async (req, res) => {
  const user_id = req.user._id;
  const items = await marketplaceService.getWishlist(user_id);
  
  res.status(200).json({ 
    success: true, 
    count: items.length,
    data: items 
  });
});


const clearWishlist = asyncHandler(async (req, res) => {
  const user_id = req.user._id;
  const result = await marketplaceService.clearWishlist(user_id);
  
  res.status(200).json({ 
    success: true, 
    message: "Wishlist cleared",
    deleted_count: result.deleted_count
  });
});

const addReview = asyncHandler(async (req, res) => {
  const { product_id, rating, comment } = req.body;
  
  if (!product_id || !rating) {
    throw new AppError("Product ID and rating are required", 400);
  }

  const user_id = req.user._id;
  const review = await marketplaceService.addReview(
    user_id,
    product_id,
    rating,
    comment
  );
  
  res.status(201).json({ 
    success: true, 
    message: "Review added successfully",
    data: review 
  });
});

const getReviews = asyncHandler(async (req, res) => {
  const { product_id } = req.params;
  const { page, limit, sort } = req.query;
  
  const result = await marketplaceService.getReviews(product_id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
    sort: sort || "-createdAt"
  });
  
  res.status(200).json({ 
    success: true, 
    data: result 
  });
});

const deleteReview = asyncHandler(async (req, res) => {
  const { review_id } = req.params;
  const user_id = req.user._id;
  
  await marketplaceService.deleteReview(review_id, user_id);
  
  res.status(200).json({ 
    success: true, 
    message: "Review deleted successfully" 
  });
});


const addItemToCart = asyncHandler(async (req, res) => {
  const { product_id, quantity } = req.body;
  
  if (!product_id || !quantity) {
    throw new AppError("Product ID and quantity are required", 400);
  }

  const user_id = req.user._id;
  const item = await marketplaceService.addItemToCart(
    user_id,
    product_id,
    quantity
  );
  
  res.status(201).json({ 
    success: true, 
    message: "Item added to cart",
    data: item 
  });
});


const updateCartItem = asyncHandler(async (req, res) => {
  const { cart_item_id } = req.params;
  const { quantity } = req.body;
  
  if (!quantity) {
    throw new AppError("Quantity is required", 400);
  }

  const user_id = req.user._id;
  const item = await marketplaceService.updateCartItemQuantity(
    cart_item_id,
    quantity,
    user_id
  );
  
  res.status(200).json({ 
    success: true, 
    message: "Cart item updated",
    data: item 
  });
});

const removeItemFromCart = asyncHandler(async (req, res) => {
  const { cart_item_id } = req.params;
  const user_id = req.user._id;
  
  await marketplaceService.removeItemFromCart(cart_item_id, user_id);
  
  res.status(200).json({ 
    success: true, 
    message: "Item removed from cart" 
  });
});

const getCartItems = asyncHandler(async (req, res) => {
  const user_id = req.user._id;
  const cart = await marketplaceService.getCartItems(user_id);
  
  res.status(200).json({ 
    success: true, 
    data: cart 
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const user_id = req.user._id;
  const result = await marketplaceService.clearCart(user_id);
  
  res.status(200).json({ 
    success: true, 
    message: "Cart cleared",
    deleted_count: result.deleted_count
  });
});

const validateCart = asyncHandler(async (req, res) => {
  const user_id = req.user._id;
  const validation = await marketplaceService.validateCart(user_id);
  
  res.status(200).json({ 
    success: true, 
    data: validation 
  });
});

module.exports = {
  // Stock
  getStock,
  updateStock,
  
  // Wishlist
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  clearWishlist,
  
  // Reviews
  addReview,
  getReviews,
  deleteReview,
  
  // Cart
  addItemToCart,
  updateCartItem,
  removeItemFromCart,
  getCartItems,
  clearCart,
  validateCart
};