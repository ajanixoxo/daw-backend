const mongoose = require('mongoose');
const Stock = require("@models/marketPlace/stockModel.js");
const Wishlist = require("@models/marketPlace/wishlistModel.js");
const Review = require("@models/marketPlace/reviewModel.js");
const Cart = require("@models/marketPlace/cartModel.js");
const CartItem = require("@models/marketPlace/cartItemModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Order = require("@models/marketPlace/orderModel.js");
const AppError = require('@utils/Error/AppError.js');


const getStockByProduct = async (product_id) => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const product = await Product.findById(product_id).select('quantity name');
  
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  return {
    product_id: product._id,
    product_name: product.name,
    quantity: product.quantity,
    in_stock: product.quantity > 0
  };
};


const updateStock = async (product_id, quantity, admin_id, reason = "manual_adjustment") => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  if (quantity < 0) {
    throw new AppError("Stock quantity cannot be negative", 400);
  }

  const product = await Product.findById(product_id);
  
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const oldQuantity = product.quantity;
  const newQty = product.quantity += quantity;
  await product.save();

  return {
    product_id: product._id,
    old_quantity: oldQuantity,
    new_quantity: newQty,
    updated_at: new Date()
  };
};


const addToWishlist = async (user_id, product_id) => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const product = await Product.findById(product_id);
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const existing = await Wishlist.findOne({ user_id, product_id });
  if (existing) {
    throw new AppError("Product already in wishlist", 409);
  }

  const wishlistItem = await Wishlist.create({ 
    user_id, 
    product_id,
    added_at: new Date()
  });

  return await Wishlist.findById(wishlistItem._id)
    .populate({
      path: 'product_id',
      select: 'name price image_url quantity category'
    });
};


const removeFromWishlist = async (user_id, product_id) => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const deleted = await Wishlist.findOneAndDelete({ user_id, product_id });
  
  if (!deleted) {
    throw new AppError("Item not found in wishlist", 404);
  }

  return { deleted: true, product_id };
};

const getWishlist = async (user_id) => {
  const wishlist = await Wishlist.find({ user_id })
    .populate({
      path: 'product_id',
      select: 'name description price image_url quantity category shop_id',
      populate: {
        path: 'shop_id',
        select: 'name'
      }
    })
    .sort({ added_at: -1 })
    .lean();

  const validItems = wishlist.filter(item => item.product_id !== null);

  return validItems.map(item => ({
    _id: item._id,
    product: {
      ...item.product_id,
      in_stock: item.product_id.quantity > 0
    },
    added_at: item.added_at
  }));
};

const clearWishlist = async (user_id) => {
  const result = await Wishlist.deleteMany({ user_id });
  return { deleted_count: result.deletedCount };
};


const addReview = async (user_id, product_id, rating, comment) => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  if (!rating || rating < 1 || rating > 5) {
    throw new AppError("Rating must be between 1 and 5", 400);
  }

  const product = await Product.findById(product_id);
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const hasPurchased = await Order.exists({
    buyer_id: user_id,
    'items.product_id': product_id,
    status: { $in: ['delivered', 'completed'] }
  });

  const existingReview = await Review.findOne({ user_id, product_id });
  if (existingReview) {
    throw new AppError("You have already reviewed this product", 409);
  }

  const review = await Review.create({
    user_id,
    product_id,
    rating,
    comment: comment?.trim(),
    verified_purchase: hasPurchased
  });

  await updateProductRating(product_id);

  return await Review.findById(review._id)
    .populate('user_id', 'firstName lastName avatar')
    .lean();
};

const getReviews = async (product_id, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  const { page = 1, limit = 10, sort = '-createdAt' } = options;
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ product_id })
      .populate('user_id', 'firstName lastName avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments({ product_id })
  ]);

  const ratingDistribution = await Review.aggregate([
    { $match: { product_id: new mongoose.Types.ObjectId(product_id) } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }
    }
  ]);

  const distribution = {};
  for (let i = 1; i <= 5; i++) {
    const found = ratingDistribution.find(r => r._id === i);
    distribution[i] = found ? found.count : 0;
  }

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    rating_distribution: distribution
  };
};

const updateProductRating = async (product_id) => {
  const stats = await Review.aggregate([
    { $match: { product_id: new mongoose.Types.ObjectId(product_id) } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(product_id, {
      average_rating: Math.round(stats[0].avgRating * 10) / 10,
      total_reviews: stats[0].totalReviews
    });
  }
};

const deleteReview = async (review_id, user_id) => {
  const review = await Review.findOne({ _id: review_id, user_id });
  
  if (!review) {
    throw new AppError("Review not found or unauthorized", 404);
  }

  const product_id = review.product_id;
  await review.deleteOne();
  
  await updateProductRating(product_id);

  return { deleted: true };
};

const addItemToCart = async (user_id, product_id, quantity) => {
  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    throw new AppError("Invalid product ID", 400);
  }

  if (!quantity || quantity <= 0) {
    throw new AppError("Quantity must be greater than 0", 400);
  }

  const product = await Product.findById(product_id);
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  if (product.quantity < quantity) {
    throw new AppError(`Only ${product.quantity} units available`, 400);
  }

  let cart = await Cart.findOne({ user_id });
  if (!cart) {
    cart = await Cart.create({ user_id });
  }

  let cartItem = await CartItem.findOne({ 
    cart_id: cart._id, 
    product_id 
  });

  if (cartItem) {
    const newQuantity = cartItem.quantity + quantity;
    
    if (product.quantity < newQuantity) {
      throw new AppError(`Cannot add more. Only ${product.quantity} units available`, 400);
    }

    cartItem.quantity = newQuantity;
    cartItem.price = product.price; 
    await cartItem.save();
  } else {
    cartItem = await CartItem.create({
      cart_id: cart._id,
      product_id,
      quantity,
      price: product.price
    });
  }

  return await CartItem.findById(cartItem._id)
    .populate({
      path: 'product_id',
      select: 'name price image_url quantity category shop_id'
    })
    .lean();
};

const updateCartItemQuantity = async (cart_item_id, quantity, user_id) => {
  if (quantity <= 0) {
    throw new AppError("Quantity must be greater than 0", 400);
  }

  const cartItem = await CartItem.findById(cart_item_id)
    .populate('cart_id');

  if (!cartItem) {
    throw new AppError("Cart item not found", 404);
  }

  if (cartItem.cart_id.user_id.toString() !== user_id.toString()) {
    throw new AppError("Unauthorized", 403);
  }

  const product = await Product.findById(cartItem.product_id);
  if (product.quantity < quantity) {
    throw new AppError(`Only ${product.quantity} units available`, 400);
  }

  cartItem.quantity += quantity;
  cartItem.price += product.price * quantity; 
  await cartItem.save();

  return await CartItem.findById(cartItem._id)
    .populate('product_id')
    .lean();
};

const removeItemFromCart = async (cart_item_id, user_id) => {
  const cartItem = await CartItem.findById(cart_item_id)
    .populate('cart_id');

  if (!cartItem) {
    throw new AppError("Cart item not found", 404);
  }

  if (cartItem.cart_id.user_id.toString() !== user_id.toString()) {
    throw new AppError("Unauthorized", 403);
  }

  await cartItem.deleteOne();
  return { deleted: true };
};


const getCartItems = async (user_id) => {
  let cart = await Cart.findOne({ user_id });
  
  if (!cart) {
    return {
      items: [],
      total_items: 0,
      total_amount: 0
    };
  }

  const items = await CartItem.find({ cart_id: cart._id })
    .populate({
      path: 'product_id',
      select: 'name description price image_url quantity category shop_id',
      populate: {
        path: 'shop_id',
        select: 'name'
      }
    })
    .lean();

  const validItems = items.filter(item => item.product_id !== null);

  let total_amount = 0;
  const enrichedItems = validItems.map(item => {
    const subtotal = item.price * item.quantity;
    total_amount += subtotal;

    return {
      _id: item._id,
      product: item.product_id,
      quantity: item.quantity,
      price: item.price,
      subtotal,
      in_stock: item.product_id.quantity >= item.quantity,
      max_available: item.product_id.quantity
    };
  });

  return {
    cart_id: cart._id,
    items: enrichedItems,
    total_items: enrichedItems.length,
    total_amount
  };
};

const clearCart = async (user_id) => {
  const cart = await Cart.findOne({ user_id });
  
  if (!cart) {
    return { deleted_count: 0 };
  }

  const result = await CartItem.deleteMany({ cart_id: cart._id });
  return { deleted_count: result.deletedCount };
};

const validateCart = async (user_id) => {
  const cartData = await getCartItems(user_id);
  
  if (cartData.items.length === 0) {
    throw new AppError("Cart is empty", 400);
  }

  const issues = [];
  
  for (const item of cartData.items) {
    if (!item.in_stock) {
      issues.push({
        product_id: item.product._id,
        product_name: item.product.name,
        requested: item.quantity,
        available: item.max_available,
        issue: 'insufficient_stock'
      });
    }
  }

  if (issues.length > 0) {
    throw new AppError("Some items are out of stock", 400, { issues });
  }

  return { valid: true, cart: cartData };
};

module.exports = {
  getStockByProduct,
  updateStock,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  clearWishlist,
  addReview,
  getReviews,
  deleteReview,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  getCartItems,
  clearCart,
  validateCart
};