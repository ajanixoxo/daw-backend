const Stock = require("@models/marketPlace/stockModel.js");
const Wishlist = require("@models/marketPlace/wishlistModel.js");
const Review = require("@models/marketPlace/reviewModel.js");
const Cart = require("@models/marketPlace/cartModel.js");
const CartItem = require("@models/marketPlace/cartItemModel.js");

// STOCK
const getStockByProduct = async (product_id) =>
  await Stock.findOne({ product_id });
const updateStock = async (product_id, quantity) => {
  return await Stock.findOneAndUpdate(
    { product_id },
    { quantity },
    { new: true, upsert: true }
  );
};

// WISHLIST
const addToWishlist = async (user_id, product_id) =>{
  const additemtowishlist = await Wishlist.findById({ user_id, product_id });
  if(additemtowishlist){
    res.status(400).json({ success: false, message: "Item already in wishlist" });
  }
  return await Wishlist.create({ user_id, product_id });
}
const removeFromWishlist = async (user_id, product_id) =>
  await Wishlist.findOneAndDelete({ user_id, product_id });
const getWishlist = async (user_id) =>
  await Wishlist.find({ user_id }).populate("product_id");

// REVIEW
const addReview = async (user_id, product_id, rating, comment) =>
  await Review.create({ user_id, product_id, rating, comment });
const getReviews = async (product_id) =>
  await Review.find({ product_id }).populate("user_id");

// CART
const addItemToCart = async (user_id, product_id, quantity, price) => {
  let cart = await Cart.findOne({ user_id });

  if (!cart) {
    cart = await Cart.create({ user_id });
  }

  let cartItem = await CartItem.findOne({ cart_id: cart._id, product_id });

  if (cartItem) {
    cartItem.quantity += quantity;
    cartItem.price = price;
    await cartItem.save();
    return cartItem;
  }

  return await CartItem.create({
    cart_id: cart._id,
    product_id,
    quantity,
    price,
  });
};

const removeItemFromCart = async (cart_item_id) =>
  await CartItem.findByIdAndDelete(cart_item_id);
const getCartItems = async (cart_id) =>
  await CartItem.find({ cart_id }).populate("product_id");

module.exports = {
  getStockByProduct,
  updateStock,
  addToWishlist,
  removeFromWishlist,
  getWishlist,
  addReview,
  getReviews,
  addItemToCart,
  removeItemFromCart,
  getCartItems,
};
