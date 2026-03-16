/**
 * Cleanup script: fixes dangling references left after shops/products were
 * deleted directly from the database.
 *
 * What it does:
 *  1. Nulls out user.shop for any seller whose shop no longer exists.
 *  2. Removes cart items whose product no longer exists.
 *
 * Safe to run multiple times (idempotent).
 *
 * Run with:  node src/scripts/cleanupOrphanedData.js
 */

require("module-alias/register");
require("dotenv").config();

const mongoose = require("mongoose");
const User     = require("@models/userModel/user.js");
const Shop     = require("@models/marketPlace/shopModel.js");
const Product  = require("@models/marketPlace/productModel.js");
const CartItem = require("@models/marketPlace/cartItemModel.js");

async function main() {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("[cleanup] Connected to MongoDB\n");

  // ── 1. Fix dangling user.shop references ──────────────────────────────────
  console.log("[cleanup] Checking for sellers with deleted shops...");

  const sellersWithShop = await User.find({
    shop: { $exists: true, $ne: null },
    roles: { $in: ["seller"] },
  }).select("_id firstName lastName email shop");

  let shopFixed = 0;
  for (const seller of sellersWithShop) {
    const shopExists = await Shop.exists({ _id: seller.shop });
    if (!shopExists) {
      await User.updateOne({ _id: seller._id }, { $unset: { shop: 1 } });
      console.log(
        `  ✓ Cleared dangling shop ref for seller: ${seller.firstName} ${seller.lastName} (${seller.email})`
      );
      shopFixed++;
    }
  }

  if (shopFixed === 0) {
    console.log("  — No dangling shop references found.");
  } else {
    console.log(`  Fixed ${shopFixed} dangling shop reference(s).\n`);
  }

  // ── 2. Remove cart items whose product no longer exists ───────────────────
  console.log("[cleanup] Checking for cart items referencing deleted products...");

  const allCartItems = await CartItem.find().select("_id product_id");
  const orphanedCartItems = [];

  for (const item of allCartItems) {
    const productExists = await Product.exists({ _id: item.product_id });
    if (!productExists) {
      orphanedCartItems.push(item._id);
    }
  }

  if (orphanedCartItems.length === 0) {
    console.log("  — No orphaned cart items found.");
  } else {
    await CartItem.deleteMany({ _id: { $in: orphanedCartItems } });
    console.log(`  ✓ Removed ${orphanedCartItems.length} orphaned cart item(s).`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n[cleanup] Done.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[cleanup] Fatal error:", err);
  process.exit(1);
});
