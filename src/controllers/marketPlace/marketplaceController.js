const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const marketplaceService = require("@services/marketPlace/marketPlaceServices.js");
const MemberService = require("@services/member.service.js");
const AppError = require("@utils/Error/AppError.js");
const User = require("@models/userModel/user.js");
const Shop = require("@models/marketPlace/shopModel.js");
const Order = require("@models/marketPlace/orderModel.js");
const SellerDocuments = require("@models/marketPlace/sellerDocumentsModel.js");
const { uploadBuffer } = require("@utils/cloudinary/cloudinary.js");
const jwt = require("jsonwebtoken");
const { verificationEmailTemplate } = require("@utils/EmailTemplate/template.js");

const JWT_SECRET = process.env.JWT_SECRET;
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Create a new shop
const createShop = asyncHandler(async (req, res) => {
  console.log("🔥 createShop controller HIT");

  // Ensure user is authenticated
  if (!req.user || !req.user._id) {
    throw new AppError("User not authenticated", 401);
  }

  const { name, description, category, logo_url, banner_url, is_member_shop, cooperative_id } = req.body;

  const owner_id = req.user._id;

  // Get user to check roles and upgrade if needed
  const foundUser = await User.findById(owner_id);
  if (!foundUser) {
    throw new AppError("User not found", 404);
  }

  // Get current roles array
  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];

  // If user has "buyer" role, automatically upgrade to "seller"
  if (currentRoles.includes("buyer") && !currentRoles.includes("seller")) {
    currentRoles.push("seller");
    foundUser.roles = currentRoles;
    await foundUser.save();
  }

  // Auto-generate store_url from shop name
  const store_url = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now();

  const shopData = {
    owner_id,
    cooperative_id: cooperative_id || null,
    name,
    store_url,
    description,
    category,
    logo_url,
    banner_url,
    is_member_shop: !!is_member_shop,
    status: "active"
  };

  const shop = await marketplaceService.createShop(shopData);
  if (!shop) {
    return res.status(400).json({
      message: "Shop not created"
    });
  }
  foundUser.shop = shop._id;
  await foundUser.save();
  return res.status(201).json({ success: true, shop });
});

/**
 * Seller onboarding (non-cooperative): shop info + document uploads.
 * POST /marketplace/seller-onboard (multipart/form-data)
 * Body: name (or shopName), description, category, contactNumber?, businessAddress?
 * Files: shopLogo?, shopBanner?, passportPhotograph, businessCac?
 * Body also includes: nin (required)
 */
const sellerOnboard = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new AppError("User not authenticated", 401);
  }

  const body = req.body || {};
  const files = req.files || {};
  const name = (body.name || body.shopName || "").trim();
  const description = (body.description || "").trim();
  const category = (body.category || "").trim();
  const contactNumber = (body.contactNumber || "").trim() || undefined;
  const businessAddress = (body.businessAddress || "").trim() || undefined;

  if (!name) { throw new AppError("Shop name is required", 400); }
  if (!description) { throw new AppError("Shop description is required", 400); }
  if (!category) { throw new AppError("Shop category is required", 400); }

  const nin = (body.nin || "").trim();
  const businessCacFile = Array.isArray(files.businessCac) ? files.businessCac[0] : files.businessCac;
  const passportPhoto = Array.isArray(files.passportPhotograph) ? files.passportPhotograph[0] : files.passportPhotograph;

  if (!nin) { throw new AppError("NIN is required", 400); }
  if (!passportPhoto || !passportPhoto.buffer) { throw new AppError("Valid Identification is required", 400); }

  const owner_id = req.user._id;
  const foundUser = await User.findById(owner_id);
  if (!foundUser) { throw new AppError("User not found", 404); }

  const folderDocs = "daw/seller-documents";
  const folderShop = "daw/shops";
  const prefix = `seller_${owner_id.toString()}`;

  const uploadPromises = [
    uploadBuffer(passportPhoto.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_passport` })
  ];
  if (businessCacFile && businessCacFile.buffer) {
    uploadPromises.push(uploadBuffer(businessCacFile.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_cac` }));
  }
  const uploadResults = await Promise.all(uploadPromises);
  const passportResult = uploadResults[0];
  const cacResult = uploadResults[1] || null;

  let logo_url = null;
  let banner_url = null;
  const shopLogo = Array.isArray(files.shopLogo) ? files.shopLogo[0] : files.shopLogo;
  const shopBanner = Array.isArray(files.shopBanner) ? files.shopBanner[0] : files.shopBanner;
  if (shopLogo && shopLogo.buffer) {
    const r = await uploadBuffer(shopLogo.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_logo` });
    logo_url = r.secure_url;
  }
  if (shopBanner && shopBanner.buffer) {
    const r = await uploadBuffer(shopBanner.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_banner` });
    banner_url = r.secure_url;
  }

  const store_url = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now();

  const shopData = {
    owner_id,
    cooperative_id: null,
    name,
    store_url,
    description,
    category,
    contact_number: contactNumber,
    business_address: businessAddress,
    logo_url,
    banner_url,
    is_member_shop: false,
    status: "active"
  };

  const shop = await marketplaceService.createShop(shopData);
  if (!shop) {
    return res.status(400).json({ message: "Shop not created" });
  }

  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];
  if (currentRoles.includes("buyer") && !currentRoles.includes("seller")) {
    currentRoles.push("seller");
    foundUser.roles = currentRoles;
  }
  if (!currentRoles.includes("buyer")) { currentRoles.push("buyer"); }
  foundUser.roles = [...new Set(currentRoles)];
  foundUser.shop = shop._id;
  await foundUser.save();

  const sellerDoc = await SellerDocuments.create({
    user_id: owner_id,
    nin,
    passport_photograph_url: passportResult.secure_url,
    business_cac_url: cacResult ? cacResult.secure_url : null,
    status: "pending"
  });

  return res.status(201).json({
    success: true,
    shop,
    sellerDocuments: {
      _id: sellerDoc._id,
      status: sellerDoc.status,
      nin: sellerDoc.nin,
      passport_photograph_url: sellerDoc.passport_photograph_url,
      business_cac_url: sellerDoc.business_cac_url
    },
    user: {
      _id: foundUser._id,
      roles: foundUser.roles,
      shop: foundUser.shop
    }
  });
});

/**
 * GET /marketplace/seller-documents/me
 * Returns whether the current user has seller documents (e.g. from seller onboarding).
 * Used by frontend to hide ID document upload on cooperative signup when already uploaded.
 */
const getMySellerDocuments = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new AppError("User not authenticated", 401);
  }
  const doc = await SellerDocuments.findOne({ user_id: req.user._id }).lean();
  if (!doc) {
    return res.status(200).json({ hasDocuments: false });
  }
  return res.status(200).json({
    hasDocuments: true,
    status: doc.status
  });
});

/**
 * Combined: guest/buyer → create user (if guest) + seller onboard (shop + docs) + join DAW cooperative.
 * POST /marketplace/cooperative-join-with-seller-onboard (multipart/form-data)
 * Optional auth: if no token, treat as guest (require firstName, lastName, email, phone, password, confirmPassword).
 * Body: firstName?, lastName?, email?, phone?, password?, confirmPassword? (guest);
 *       name|shopName, description, category, contactNumber?, businessAddress?, cooperativeId, subscriptionTierId
 * Files: shopLogo?, shopBanner?, passportPhotograph, businessCac?
 * Body also includes: nin (required)
 */
const cooperativeJoinWithSellerOnboard = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const files = req.files || {};
  let userId;
  let guestTempToken = null;

  if (!req.user || !req.user._id) {
    const { firstName, lastName, email, phone, password, confirmPassword, country, currency } = body;
    if (!email || !password || !confirmPassword || !firstName || !phone) {
      throw new AppError("email, password, confirmPassword, firstName, and phone are required for guest", 400);
    }
    if (password !== confirmPassword) { throw new AppError("Passwords must match", 400); }
    if (password.length < 6) { throw new AppError("Password must be at least 6 characters", 400); }
    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existingUser) {
      throw new AppError("User already exists. Please log in and use the cooperative signup flow.", 400);
    }

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const newUser = await User.create({
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      email: String(email).toLowerCase().trim(),
      phone: (phone || "").trim(),
      password,
      country: (country || "").trim(),
      currency: (currency || "USD").trim(),
      roles: ["buyer"],
      isVerified: false,
      otp,
      otpExpiry
    });
    await verificationEmailTemplate(newUser.email, newUser.firstName, otp);
    if (!JWT_SECRET) {
      throw new AppError("JWT_SECRET is not configured on the server", 500);
    }
    guestTempToken = jwt.sign(
      { _id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "15min" }
    );
    userId = newUser._id;
  } else {
    userId = req.user._id;
  }

  const cooperativeId = (body.cooperativeId || "").trim();
  const subscriptionTierId = (body.subscriptionTierId || "").trim();
  if (!cooperativeId || !mongoose.Types.ObjectId.isValid(cooperativeId)) {
    throw new AppError("Valid cooperativeId is required", 400);
  }
  if (!subscriptionTierId || !mongoose.Types.ObjectId.isValid(subscriptionTierId)) {
    throw new AppError("Valid subscriptionTierId is required", 400);
  }

  const name = (body.name || body.shopName || "").trim();
  const description = (body.description || "").trim();
  const category = (body.category || "").trim();
  const contactNumber = (body.contactNumber || "").trim() || undefined;
  const businessAddress = (body.businessAddress || "").trim() || undefined;
  if (!name) { throw new AppError("Shop name is required", 400); }
  if (!description) { throw new AppError("Shop description is required", 400); }
  if (!category) { throw new AppError("Shop category is required", 400); }

  const nin = (body.nin || "").trim();
  const businessCacFile = Array.isArray(files.businessCac) ? files.businessCac[0] : files.businessCac;
  const passportPhoto = Array.isArray(files.passportPhotograph) ? files.passportPhotograph[0] : files.passportPhotograph;
  if (!nin) { throw new AppError("NIN is required", 400); }
  if (!passportPhoto || !passportPhoto.buffer) { throw new AppError("Valid Identification is required", 400); }

  const foundUser = await User.findById(userId);
  if (!foundUser) { throw new AppError("User not found", 404); }

  const folderDocs = "daw/seller-documents";
  const folderShop = "daw/shops";
  const prefix = `seller_${userId.toString()}`;

  const uploadPromises = [
    uploadBuffer(passportPhoto.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_passport` })
  ];
  if (businessCacFile && businessCacFile.buffer) {
    uploadPromises.push(uploadBuffer(businessCacFile.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_cac` }));
  }
  const uploadResults = await Promise.all(uploadPromises);
  const passportResult = uploadResults[0];
  const cacResult = uploadResults[1] || null;

  let logo_url = null;
  let banner_url = null;
  const shopLogo = Array.isArray(files.shopLogo) ? files.shopLogo[0] : files.shopLogo;
  const shopBanner = Array.isArray(files.shopBanner) ? files.shopBanner[0] : files.shopBanner;
  if (shopLogo && shopLogo.buffer) {
    const r = await uploadBuffer(shopLogo.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_logo` });
    logo_url = r.secure_url;
  }
  if (shopBanner && shopBanner.buffer) {
    const r = await uploadBuffer(shopBanner.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_banner` });
    banner_url = r.secure_url;
  }

  // Reuse/update existing shop if the user already has one.
  // This avoids intermittent duplicate-key failures from the unique owner_id index.
  let shop = await Shop.findOne({ owner_id: userId });

  if (shop) {
    shop.name = name;
    shop.description = description;
    shop.category = category;
    shop.contact_number = contactNumber;
    shop.business_address = businessAddress;
    shop.cooperative_id = cooperativeId;
    shop.is_member_shop = true;
    shop.status = "active";
    if (logo_url) { shop.logo_url = logo_url; }
    if (banner_url) { shop.banner_url = banner_url; }
    await shop.save();
  } else {
    const coopStoreUrl = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + Date.now();

    const shopData = {
      owner_id: userId,
      cooperative_id: cooperativeId,
      name,
      store_url: coopStoreUrl,
      description,
      category,
      contact_number: contactNumber,
      business_address: businessAddress,
      logo_url,
      banner_url,
      is_member_shop: true,
      status: "active"
    };
    shop = await marketplaceService.createShop(shopData);
    if (!shop) { throw new AppError("Shop not created", 400); }
  }

  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];
  if (!currentRoles.includes("seller")) { currentRoles.push("seller"); }
  if (!currentRoles.includes("buyer")) { currentRoles.push("buyer"); }
  foundUser.roles = [...new Set(currentRoles)];
  foundUser.shop = shop._id;
  await foundUser.save();

  const sellerDoc = await SellerDocuments.create({
    user_id: userId,
    nin,
    passport_photograph_url: passportResult.secure_url,
    business_cac_url: cacResult ? cacResult.secure_url : null,
    status: "pending"
  });

  const member = await MemberService.joinCooperative({
    userId,
    cooperativeId,
    subscriptionTierId
  });

  const isGuest = !req.user || !req.user._id;

  // Fetch the updated user so frontend can sync roles
  const updatedUser = await User.findById(userId)
    .select("firstName lastName email phone roles isVerified status shop avatar")
    .populate("shop", "_id name")
    .lean();

  res.status(201).json({
    success: true,
    message: isGuest
      ? "Account created, seller onboarded, and joined cooperative. OTP sent to email for verification."
      : "Seller onboarded and joined cooperative.",
    member,
    shop: { _id: shop._id, name: shop.name, status: shop.status },
    sellerDocuments: { _id: sellerDoc._id, status: sellerDoc.status },
    ...(isGuest ? { token: guestTempToken } : {}),
    user: updatedUser,
  });
});

/**
 * Guest seller onboard: guest/buyer → create user (if guest) + seller onboard (shop + docs).
 * POST /marketplace/guest-seller-onboard (multipart/form-data)
 * Optional auth: if no token, treat as guest (require firstName, lastName, email, phone, password, confirmPassword).
 * Body: firstName?, lastName?, email?, phone?, password?, confirmPassword? (guest);
 *       name|shopName, description, category, contactNumber?, businessAddress?
 * Files: shopLogo?, shopBanner?, passportPhotograph, businessCac?
 * Body also includes: nin (required)
 */
const guestSellerOnboard = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const files = req.files || {};
  let userId;
  let guestTempToken = null;

  if (!req.user || !req.user._id) {
    const { firstName, lastName, email, phone, password, confirmPassword, country, currency } = body;
    if (!email || !password || !confirmPassword || !firstName || !phone) {
      throw new AppError("email, password, confirmPassword, firstName, and phone are required for guest", 400);
    }
    if (password !== confirmPassword) { throw new AppError("Passwords must match", 400); }
    if (password.length < 6) { throw new AppError("Password must be at least 6 characters", 400); }
    const existingUser = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existingUser) {
      throw new AppError("User already exists. Please log in and use the cooperative signup flow.", 400);
    }

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const newUser = await User.create({
      firstName: (firstName || "").trim(),
      lastName: (lastName || "").trim(),
      email: String(email).toLowerCase().trim(),
      phone: (phone || "").trim(),
      password,
      country: (country || "").trim(),
      currency: (currency || "USD").trim(),
      roles: ["buyer"],
      isVerified: false,
      otp,
      otpExpiry
    });
    await verificationEmailTemplate(newUser.email, newUser.firstName, otp);
    if (!JWT_SECRET) {
      throw new AppError("JWT_SECRET is not configured on the server", 500);
    }
    guestTempToken = jwt.sign(
      { _id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: "15min" }
    );
    userId = newUser._id;
  } else {
    userId = req.user._id;
  }

  const name = (body.name || body.shopName || "").trim();
  const description = (body.description || "").trim();
  const category = (body.category || "").trim();
  const contactNumber = (body.contactNumber || "").trim() || undefined;
  const businessAddress = (body.businessAddress || "").trim() || undefined;
  if (!name) { throw new AppError("Shop name is required", 400); }
  if (!description) { throw new AppError("Shop description is required", 400); }
  if (!category) { throw new AppError("Shop category is required", 400); }

  const nin = (body.nin || "").trim();
  const businessCacFile = Array.isArray(files.businessCac) ? files.businessCac[0] : files.businessCac;
  const passportPhoto = Array.isArray(files.passportPhotograph) ? files.passportPhotograph[0] : files.passportPhotograph;
  if (!nin) { throw new AppError("NIN is required", 400); }
  if (!passportPhoto || !passportPhoto.buffer) { throw new AppError("Valid Identification is required", 400); }

  const foundUser = await User.findById(userId);
  if (!foundUser) { throw new AppError("User not found", 404); }

  const folderDocs = "daw/seller-documents";
  const folderShop = "daw/shops";
  const prefix = `seller_${userId.toString()}`;

  const uploadPromises = [
    uploadBuffer(passportPhoto.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_passport` })
  ];
  if (businessCacFile && businessCacFile.buffer) {
    uploadPromises.push(uploadBuffer(businessCacFile.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_cac` }));
  }
  const uploadResults = await Promise.all(uploadPromises);
  const passportResult = uploadResults[0];
  const cacResult = uploadResults[1] || null;

  let logo_url = null;
  let banner_url = null;
  const shopLogo = Array.isArray(files.shopLogo) ? files.shopLogo[0] : files.shopLogo;
  const shopBanner = Array.isArray(files.shopBanner) ? files.shopBanner[0] : files.shopBanner;
  if (shopLogo && shopLogo.buffer) {
    const r = await uploadBuffer(shopLogo.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_logo` });
    logo_url = r.secure_url;
  }
  if (shopBanner && shopBanner.buffer) {
    const r = await uploadBuffer(shopBanner.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_banner` });
    banner_url = r.secure_url;
  }

  const storeUrl = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now();

  const shopData = {
    owner_id: userId,
    name,
    store_url: storeUrl,
    description,
    category,
    contact_number: contactNumber,
    business_address: businessAddress,
    logo_url,
    banner_url,
    is_member_shop: false,
    status: "active"
  };
  const shop = await marketplaceService.createShop(shopData);
  if (!shop) { throw new AppError("Shop not created", 400); }

  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];
  if (!currentRoles.includes("seller")) { currentRoles.push("seller"); }
  if (!currentRoles.includes("buyer")) { currentRoles.push("buyer"); }
  foundUser.roles = [...new Set(currentRoles)];
  foundUser.shop = shop._id;
  await foundUser.save();

  const sellerDoc = await SellerDocuments.create({
    user_id: userId,
    nin,
    passport_photograph_url: passportResult.secure_url,
    business_cac_url: cacResult ? cacResult.secure_url : null,
    status: "pending"
  });

  const isGuest = !req.user || !req.user._id;
  // Build user object with the UPDATED roles (after seller role was added)
  const updatedUser = {
    _id: foundUser._id,
    firstName: foundUser.firstName,
    lastName: foundUser.lastName,
    email: foundUser.email,
    phone: foundUser.phone,
    roles: foundUser.roles,
    shop: foundUser.shop
  };
  res.status(201).json({
    success: true,
    message: isGuest
      ? "Account created and seller onboarded. OTP sent to email for verification."
      : "Seller onboarded successfully.",
    shop: { _id: shop._id, name: shop.name, status: shop.status },
    sellerDocuments: { _id: sellerDoc._id, status: sellerDoc.status },
    ...(isGuest ? { token: guestTempToken, user: updatedUser } : { user: updatedUser })
  });
});

/**
 * Guest seller onboard: guest/buyer → create user (if guest) + seller onboard (shop + docs).
 * POST /marketplace/guest-seller-onboard (multipart/form-data)
 * Optional auth: if no token, treat as guest (require firstName, lastName, email, phone, password, confirmPassword).
 * Body: firstName?, lastName?, email?, phone?, password?, confirmPassword? (guest);
 *       name|shopName, description, category, contactNumber?, businessAddress?
 * Files: shopLogo?, shopBanner?, passportPhotograph, businessCac?
 * Body also includes: nin (required)
 */


// Get all shops
const getShops = asyncHandler(async (req, res) => {
  const shops = await marketplaceService.getShops();
  res.status(200).json({ success: true, shops });
});

// Get single shop by ID
const getShopById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const shop = await marketplaceService.getShopById(id);
  if (!shop) { return res.status(404).json({ message: "Shop not found" }); }
  return res.status(200).json({ success: true, shop });
});

// Create a product (seller/admin)
const createProduct = asyncHandler(async (req, res) => {
  console.log("createProduct req.body:", req.body);
  console.log("createProduct req.files:", req.files?.length);
  const { shop_id, name, quantity, price, weight, location, category, description, status, variants, productFeatures, careInstruction, returnPolicy } = req.body;

  if (!shop_id) {
    throw new AppError("Shop ID is required", 400);
  }

  if (!name) {
    throw new AppError("Product name is required", 400);
  }
  if (!weight) {
    throw new AppError("Product weight is required", 400);
  }
  if (!location) {
    throw new AppError("Product location is required", 400);
  }

  if (quantity === undefined || quantity === null) {
    throw new AppError("Quantity is required", 400);
  }

  if (price === undefined || price === null) {
    throw new AppError("Price is required", 400);
  }

  // Verify the shop exists and belongs to the user
  const shop = await Shop.findOne({
    _id: shop_id,
    owner_id: req.user._id,
    status: "active"
  });

  if (!shop) {
    throw new AppError("Shop not found or you don't have permission to add products to this shop", 403);
  }

  // Upload images to Cloudinary if provided
  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    const folder = "daw/products";
    const prefix = `product_${shop_id}`;
    const uploadPromises = req.files.map((file, index) =>
      uploadBuffer(file.buffer, {
        folder,
        publicIdPrefix: `${prefix}_${Date.now()}_${index}`
      })
    );
    const results = await Promise.all(uploadPromises);
    imageUrls = results.map((r) => r.secure_url);
  }

  // Parse variants if sent as JSON string (multipart/form-data)
  let parsedVariants;
  if (typeof variants === "string") {
    try {
      parsedVariants = JSON.parse(variants);
    } catch {
      parsedVariants = undefined;
    }
  } else {
    parsedVariants = variants;
  }

  const product = await marketplaceService.createProduct({
    sellerId: req.user._id,
    shopId: shop_id,
    name,
    weight: Number(weight),
    location,
    quantity: Number(quantity),
    price: Number(price),
    category,
    description,
    images: imageUrls,
    status,
    variants: parsedVariants,
    productFeatures,
    careInstruction,
    returnPolicy
  });

  res.status(201).json({ success: true, product });
});

// Edit a product (seller/admin) — partial update, only dirty fields
const editProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { name, quantity, price, weight, location, category, description, status, variants, productFeatures, careInstruction, returnPolicy, existingImages } = req.body;

  if (!productId) {
    throw new AppError("Product ID is required", 400);
  }

  // Upload new images to Cloudinary if provided
  let newImageUrls = [];
  if (req.files && req.files.length > 0) {
    const folder = "daw/products";
    const prefix = `product_${productId}`;
    const uploadPromises = req.files.map((file, index) =>
      uploadBuffer(file.buffer, {
        folder,
        publicIdPrefix: `${prefix}_${Date.now()}_${index}`
      })
    );
    const results = await Promise.all(uploadPromises);
    newImageUrls = results.map((r) => r.secure_url);
  }

  // Parse variants if sent as JSON string (multipart/form-data)
  let parsedVariants;
  if (typeof variants === "string") {
    try {
      parsedVariants = JSON.parse(variants);
    } catch {
      parsedVariants = undefined;
    }
  } else {
    parsedVariants = variants;
  }

  // Parse existingImages if sent as JSON string
  let parsedExistingImages;
  if (typeof existingImages === "string") {
    try {
      parsedExistingImages = JSON.parse(existingImages);
    } catch {
      parsedExistingImages = undefined;
    }
  } else {
    parsedExistingImages = existingImages;
  }

  // Build updates object — only include fields that were sent
  const updates = {};
  if (name !== undefined) { updates.name = name; }
  if (quantity !== undefined) { updates.quantity = Number(quantity); }
  if (price !== undefined) { updates.price = Number(price); }
  if (weight !== undefined) { updates.weight = Number(weight); }
  if (location !== undefined) { updates.location = location; }
  if (category !== undefined) { updates.category = category; }
  if (description !== undefined) { updates.description = description; }
  if (status !== undefined) { updates.status = status; }
  if (parsedVariants !== undefined) { updates.variants = parsedVariants; }
  if (productFeatures !== undefined) { updates.productFeatures = productFeatures; }
  if (careInstruction !== undefined) { updates.careInstruction = careInstruction; }
  if (returnPolicy !== undefined) { updates.returnPolicy = returnPolicy; }

  // Merge existing images (kept) with newly uploaded ones
  if (parsedExistingImages !== undefined || newImageUrls.length > 0) {
    const kept = Array.isArray(parsedExistingImages) ? parsedExistingImages : [];
    updates.images = [...kept, ...newImageUrls];
  }

  const product = await marketplaceService.editProduct({
    sellerId: req.user._id,
    productId,
    updates
  });

  res.status(200).json({ success: true, product });
});

// Delete a product (seller/admin)
const deleteProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!productId) {
    throw new AppError("Product ID is required", 400);
  }

  const result = await marketplaceService.deleteProduct({
    sellerId: req.user._id,
    productId
  });

  res.status(200).json({ success: true, message: result.message });
});

const getProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const productView = await marketplaceService.getProductById(productId, req.user);
    if (!productView) {
      return res.status(404).json({
        message: "product not found"
      });
    }

    return res.status(200).json({
      message: "Product fetched successfully",
      product: productView
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error while fetching product",
      error: error.message
    });
  }
};
// Get products by shop
const getProductsByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;
  const products = await marketplaceService.getProductsByShop(shop_id, req.user);
  res.status(200).json({ success: true, products });
});

// Place an order (buyer)
const createOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const buyer_id = req.user._id;
  console.log("Creating order for buyer:", buyer_id, "with items:", items);
  if (!items || items.length === 0) {
    throw new AppError("Order items are required", 400);
  }

  const checkIfUserExist = await User.findById(buyer_id);
  if (!checkIfUserExist) {
    throw new AppError("User not found", 404);
  }
  
  const { order, orders, orderItems } =
    await marketplaceService.createOrder(buyer_id, items);

  res.status(201).json({
    success: true,
    order,
    orders,
    orderIds: orders.map(o => o._id),
    orderItems
  });
});


// Get orders by buyer
const getOrdersByBuyer = asyncHandler(async (req, res) => {
  const buyer_id = req.user._id;
  const orders = await marketplaceService.getOrdersByBuyer(buyer_id);
  res.status(200).json({ success: true, orders });
});

const getoRdersById = asyncHandler(async (req, res) => {
  const buyer_id = req.user._id;
  const { orderId } = req.params;
  const order = await marketplaceService.getOrdersById(orderId);

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  return res.status(200).json({ success: true, order });
});

const getAllProduct = asyncHandler(async (req, res) => {
  try {
    const products = await marketplaceService.getAllProduct(req.user);
    if (!products) {
      return res.status(400).json({
        message: "No products available"
      });
    }

    return res.status(200).json({
      message: "Fetched all the products",
      products: products
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error during fetching the products",
      error: error.message
    });
  }
});

const getOrdersByShop = asyncHandler(async (req, res) => {
  const { shop_id } = req.params;

  const shop = await Shop.findById(shop_id);

  if (!shop) {
    return res.status(404).json({
      success: false,
      message: "Shop not found"
    });
  }

  if (
    !shop ||
    (req.user.roles.includes("seller") &&
      shop.owner_id.toString() !== req.user._id.toString())
  ) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to view orders for this shop"
    });
  }
  const orders = await marketplaceService.getOrdersByShopId(shop_id);

  res.status(200).json({
    success: true,
    orders: orders || [],
  });
});

const getSellerDetails = asyncHandler(async (req, res) => {
  const { orderId } = req.query;

  if (!orderId) {
    throw new AppError("orderId is required", 400);
  }

  const orderDetails = await Order.findById(orderId);
  if (!orderDetails) {
    throw new AppError("Order does not exist", 404);
  }

  const shopDetails = await Shop.findById(orderDetails.shop_id);
  if (!shopDetails) {
    throw new AppError("Shop does not exist", 404);
  }

  const userDetails = await User.findById(shopDetails.owner_id)
    .select(
      "firstName lastName email phone accountName accountNo bankCode bankName accountId"
    );

  if (!userDetails) {
    throw new AppError("Seller does not exist", 404);
  }

  res.status(200).json({
    success: true,
    message: "Seller details fetched successfully",
    seller: userDetails,
    order: {
      paymentStatus: orderDetails.payment_status,
      totalAmount: orderDetails.total_amount,
      escrowStatus: orderDetails.escrow_status
    },
    shop: shopDetails
  });
});


// Get the current user's shop
const getMyShop = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new AppError("User not authenticated", 401);
  }

  const shop = await marketplaceService.getShopByOwnerId(req.user._id);
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found. Please create a shop first." });
  }

  // Also get product count for this shop
  const Product = require("@models/marketPlace/productModel.js");
  const productCount = await Product.countDocuments({ shop_id: shop._id });

  return res.status(200).json({
    success: true,
    shop,
    productCount
  });
});

const editShops = asyncHandler(async (req, res) => {
  const { id: shopId } = req.params;
  const ownerId = req.user._id;
  const files = req.files || {};

  const data = { ...req.body };

  // Handle logo upload
  const shopLogo = Array.isArray(files.shopLogo) ? files.shopLogo[0] : files.shopLogo;
  if (shopLogo && shopLogo.buffer) {
    const folderShop = "daw/shops";
    const prefix = `seller_${ownerId.toString()}`;
    const r = await uploadBuffer(shopLogo.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_logo` });
    data.logo_url = r.secure_url;
  }

  // Handle banner upload
  const shopBanner = Array.isArray(files.shopBanner) ? files.shopBanner[0] : files.shopBanner;
  if (shopBanner && shopBanner.buffer) {
    const folderShop = "daw/shops";
    const prefix = `seller_${ownerId.toString()}`;
    const r = await uploadBuffer(shopBanner.buffer, { folder: folderShop, publicIdPrefix: `${prefix}_banner` });
    data.banner_url = r.secure_url;
  }

  const updatedShop = await marketplaceService.editShop({
    shopId,
    ownerId,
    data
  });

  return res.status(200).json({
    success: true,
    message: "Shop updated successfully",
    shop: updatedShop
  });
});

// Track a shop view (works for guests and logged-in users)
const trackShopView = asyncHandler(async (req, res) => {
  const { id: shopId } = req.params;
  const viewerId = req.user ? req.user._id : null;
  const ipAddress = req.ip;

  await marketplaceService.recordShopView(shopId, viewerId, ipAddress);

  res.status(201).json({ success: true });
});

// Get shop stats (view count) for the shop owner
const getShopStats = asyncHandler(async (req, res) => {
  const { id: shopId } = req.params;

  const viewCount = await marketplaceService.getShopViewCount(shopId);

  res.status(200).json({ success: true, viewCount });
});

// Update order status (seller/admin)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!orderId || !status) {
    throw new AppError("Order ID and status are required", 400);
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new AppError("Order not found", 404);
  }

  const oldStatus = order.status;
  order.status = status;

  // Business logic: When order is delivered, release funds to seller's available balance
  if (status === "delivered" && oldStatus !== "delivered") {
    const shop = await Shop.findById(order.shop_id);
    if (!shop) {
      throw new AppError("Shop not found for this order", 404);
    }

    const seller = await User.findById(shop.owner_id);
    if (!seller) {
      throw new AppError("Seller not found", 404);
    }

    // Move funds from pending to account_Balance (Available)
    // seller.pending_amount should have been increased by verifyPayment
    const amountToTransfer = order.total_amount;

    seller.pending_amount = Math.max(0, (seller.pending_amount || 0) - amountToTransfer);
    seller.account_Balance = (seller.account_Balance || 0) + amountToTransfer;

    order.escrow_status = "released";

    await seller.save();
    console.log(`Funds released for order ${orderId}: ${amountToTransfer} moved to seller ${seller._id} available balance.`);
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: `Order status updated to ${status}`,
    order
  });
});

const calculateDeliveryFee = asyncHandler(async (req, res) => {
  const { orderId, country, state } = req.body;
  console.log(country, state, orderId)

  if (!orderId || !country) {
    throw new AppError("orderId and country are required", 400);
  }

  const OrderItem = require("@models/marketPlace/orderItemModel");
  const Order = require("@models/marketPlace/orderModel");
  const ShippingPricing = require("@models/marketPlace/shippingPricingModel");

  const orderItems = await OrderItem.find({ order_id: orderId }).populate("product_id");
  let totalWeight = 0;

  for (const item of orderItems) {
    const w = item.product_id?.weight || 1.0; 
    totalWeight += (w * item.quantity);
  }
  
  if (totalWeight === 0) totalWeight = 1.0; // fallback min weight

  let deliveryFee = 0;

  if (country.toLowerCase() === "nigeria") {
    const isNorth = ["Kano", "Kaduna", "Borno", "Sokoto", "Katsina", "Niger", "Plateau", "Bauchi", "Jigawa", "Yobe", "Zamfara", "Kebbi", "Gombe", "Taraba", "Adamawa"].includes(state);
    const regionType = isNorth ? "north" : "general";

    // Round up the weight so 10.5kg becomes 11kg, falling into the 11-15kg bucket correctly
    const roundedWeight = Math.ceil(totalWeight);

    const rule = await ShippingPricing.findOne({
      type: "national",
      regionType,
      // minWeight: { $lte: roundedWeight },
      // maxWeight: { $gte: roundedWeight }
    });

    if (!rule) {
      throw new AppError("No shipping rule found for this weight and region", 400);
    }

    deliveryFee = (rule.pickupFee || 0) + (rule.deliveryFee || 0);
    if (rule.freightFee > 0) {
      deliveryFee += rule.freightFee;
    } else {
      deliveryFee += (totalWeight * (rule.perKgRate || 0));
    }
  } else {
    let weightTier = totalWeight <= 5 ? Math.ceil(totalWeight * 2) / 2 : Math.ceil(totalWeight);
    if (weightTier < 0.5) weightTier = 0.5;

    const rule = await ShippingPricing.findOne({
      type: "international",
      weight: weightTier
    });

    if (!rule) {
      throw new AppError(`No international shipping rule found for weight ${weightTier}kg`, 400);
    }

    let region = "restOfAfrica";
    const usaNames = ["United States", "USA"];
    const canadaNames = ["Canada"];
    const ukNames = ["United Kingdom", "UK", "England", "Scotland", "Wales", "Northern Ireland"];
    const europeNames = ["France", "Germany", "Spain", "Italy", "Netherlands", "Belgium", "Austria", "Sweden", "Switzerland", "Poland", "Portugal", "Greece", "Ireland"];
    const ausNames = ["Australia", "New Zealand"];
    const asiaNames = ["China", "Japan", "India", "South Korea", "Singapore", "Malaysia", "Indonesia", "Vietnam", "Pakistan", "Bangladesh", "Thailand", "Philippines"];
    const westAfricaNames = ["Ghana", "Benin", "Togo", "Cote d'Ivoire", "Senegal", "Mali", "Burkina Faso", "Gambia", "Guinea", "Sierra Leone", "Niger", "Mauritania"];
    const farEuropeUAENames = ["United Arab Emirates", "Saudi Arabia", "Qatar", "Russia", "Kuwait", "Oman"];

    if (usaNames.includes(country)) region = "usa";
    else if (canadaNames.includes(country)) region = "canada";
    else if (ukNames.includes(country)) region = "uk";
    else if (europeNames.includes(country)) region = "europe";
    else if (ausNames.includes(country)) region = "australia";
    else if (asiaNames.includes(country)) region = "asia";
    else if (westAfricaNames.includes(country)) region = "westAfrica";
    else if (farEuropeUAENames.includes(country)) region = "farEuropeUAE";

    deliveryFee = rule.prices[region];
    if (deliveryFee === undefined) {
       throw new AppError(`Shipping to ${country} is not supported yet`, 400);
    }
  }

  // Update order with dynamic delivery fee
  const order = await Order.findById(orderId);
  if (order) {
    // Avoid double counting if already added previously
    if (order.delivery_fee !== deliveryFee) {
      const difference = deliveryFee - (order.delivery_fee || 0);
      order.delivery_fee = deliveryFee;
      order.total_amount += difference;
      await order.save();
    }
  }

  res.status(200).json({
    success: true,
    deliveryFee,
    totalAmount: order ? order.total_amount : undefined
  });
});

module.exports = {
  createShop,
  sellerOnboard,
  guestSellerOnboard,
  cooperativeJoinWithSellerOnboard,
  getMySellerDocuments,
  getMyShop,
  getShops,
  getShopById,
  createProduct,
  editProduct,
  deleteProduct,
  getOrdersByShop,
  getProductsByShop,
  createOrder,
  getOrdersByBuyer,
  getoRdersById,
  getAllProduct,
  getProduct,
  getSellerDetails,
  editShops,
  trackShopView,
  getShopStats,
  updateOrderStatus,
  calculateDeliveryFee
};
