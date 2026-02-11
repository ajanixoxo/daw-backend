const Category = require("@models/marketPlace/categoryModel.js");
const Shop = require("@models/marketPlace/shopModel.js");
const AppError = require("@utils/Error/AppError.js");

const createCategory = async ({ shopId, ownerId, name, description, color }) => {
  const shop = await Shop.findOne({
    _id: shopId,
    owner_id: ownerId,
    status: "active",
  });

  if (!shop) {
    throw new AppError("Invalid or inactive shop", 403);
  }

  const existing = await Category.findOne({
    shop_id: shopId,
    name: { $regex: `^${name}$`, $options: "i" },
  });

  if (existing) {
    throw new AppError("Category already exists in this shop", 409);
  }

  return await Category.create({
    shop_id: shopId,
    name,
    description: description || "",
    color: color || "#f10e7c",
  });
};

const getCategoriesByShop = async (shopId) => {
  return await Category.find({ shop_id: shopId }).sort({ name: 1 });
};

module.exports = {
  createCategory,
  getCategoriesByShop,
};
