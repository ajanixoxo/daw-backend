const asyncHandler = require("express-async-handler");
const AppError = require("@utils/Error/AppError.js");
const categoryService = require("@services/marketPlace/categoryService.js");

const createCategory = asyncHandler(async (req, res) => {
  const { shop_id, name, description, color } = req.body;

  if (!shop_id) {
    throw new AppError("Shop ID is required", 400);
  }

  if (!name) {
    throw new AppError("Category name is required", 400);
  }

  const category = await categoryService.createCategory({
    shopId: shop_id,
    ownerId: req.user._id,
    name,
    description,
    color
  });

  res.status(201).json({ success: true, category });
});

const getCategoriesByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;

  const categories = await categoryService.getCategoriesByShop(shop_id);

  res.status(200).json({ success: true, categories });
});

module.exports = {
  createCategory,
  getCategoriesByShop
};
