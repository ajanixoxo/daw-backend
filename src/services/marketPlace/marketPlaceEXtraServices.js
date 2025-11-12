const Stock = require('@models/marketplace/stockModel.js');
const Wishlist = require('@models/marketplace/wishlistModel.js');
const Review = require('@models/marketplace/reviewModel.js');
const Cart = require('@models/marketplace/cartModel.js');
const CartItem = require('@models/marketplace/cartItemModel.js');

// STOCK
const getStockByProduct = async (product_id) => await Stock.findOne({ product_id });
const updateStock = async (product_id, quantity) => {
    return await Stock.findOneAndUpdate({ product_id }, { quantity }, { new: true, upsert: true });
};

// WISHLIST
const addToWishlist = async (user_id, product_id) => await Wishlist.create({ user_id, product_id });
const removeFromWishlist = async (user_id, product_id) => await Wishlist.findOneAndDelete({ user_id, product_id });
const getWishlist = async (user_id) => await Wishlist.find({ user_id }).populate("product_id");

// REVIEW
const addReview = async (user_id, product_id, rating, comment) => await Review.create({ user_id, product_id, rating, comment });
const getReviews = async (product_id) => await Review.find({ product_id }).populate("user_id");

// CART
const createCart = async (user_id) => await Cart.create({ user_id });
const addItemToCart = async (cart_id, product_id, quantity, price) => await CartItem.create({ cart_id, product_id, quantity, price });
const removeItemFromCart = async (cart_item_id) => await CartItem.findByIdAndDelete(cart_item_id);
const getCartItems = async (cart_id) => await CartItem.find({ cart_id }).populate("product_id");

module.exports = {
    getStockByProduct,
    updateStock,
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    addReview,
    getReviews,
    createCart,
    addItemToCart,
    removeItemFromCart,
    getCartItems
}
