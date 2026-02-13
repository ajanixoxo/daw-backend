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
 * Files: shopLogo?, shopBanner?, idDocument, proofOfResidence, businessCac, passportPhotograph
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

  if (!name) {throw new AppError("Shop name is required", 400);}
  if (!description) {throw new AppError("Shop description is required", 400);}
  if (!category) {throw new AppError("Shop category is required", 400);}

  const idDoc = Array.isArray(files.idDocument) ? files.idDocument[0] : files.idDocument;
  const proofRes = Array.isArray(files.proofOfResidence) ? files.proofOfResidence[0] : files.proofOfResidence;
  const businessCacFile = Array.isArray(files.businessCac) ? files.businessCac[0] : files.businessCac;
  const passportPhoto = Array.isArray(files.passportPhotograph) ? files.passportPhotograph[0] : files.passportPhotograph;

  if (!idDoc || !idDoc.buffer) {throw new AppError("ID document is required", 400);}
  if (!proofRes || !proofRes.buffer) {throw new AppError("Proof of residence is required", 400);}
  if (!businessCacFile || !businessCacFile.buffer) {throw new AppError("Business CAC is required", 400);}
  if (!passportPhoto || !passportPhoto.buffer) {throw new AppError("Passport photograph is required", 400);}

  const owner_id = req.user._id;
  const foundUser = await User.findById(owner_id);
  if (!foundUser) {throw new AppError("User not found", 404);}

  const folderDocs = "daw/seller-documents";
  const folderShop = "daw/shops";
  const prefix = `seller_${owner_id.toString()}`;

  const [idDocResult, proofResResult, cacResult, passportResult] = await Promise.all([
    uploadBuffer(idDoc.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_id` }),
    uploadBuffer(proofRes.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_proof` }),
    uploadBuffer(businessCacFile.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_cac` }),
    uploadBuffer(passportPhoto.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_passport` })
  ]);

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
  if (!currentRoles.includes("buyer")) {currentRoles.push("buyer");}
  foundUser.roles = [...new Set(currentRoles)];
  foundUser.shop = shop._id;
  await foundUser.save();

  const sellerDoc = await SellerDocuments.create({
    user_id: owner_id,
    id_document_url: idDocResult.secure_url,
    proof_of_residence_url: proofResResult.secure_url,
    business_cac_url: cacResult.secure_url,
    passport_photograph_url: passportResult.secure_url,
    status: "pending"
  });

  return res.status(201).json({
    success: true,
    shop,
    sellerDocuments: {
      _id: sellerDoc._id,
      status: sellerDoc.status,
      id_document_url: sellerDoc.id_document_url,
      proof_of_residence_url: sellerDoc.proof_of_residence_url,
      business_cac_url: sellerDoc.business_cac_url,
      passport_photograph_url: sellerDoc.passport_photograph_url
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
 * Files: shopLogo?, shopBanner?, idDocument, proofOfResidence, businessCac, passportPhotograph
 */
const cooperativeJoinWithSellerOnboard = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const files = req.files || {};
  let userId;
  let guestUser = null;
  let guestTempToken = null;

  if (!req.user || !req.user._id) {
    const { firstName, lastName, email, phone, password, confirmPassword } = body;
    if (!email || !password || !confirmPassword || !firstName || !phone) {
      throw new AppError("email, password, confirmPassword, firstName, and phone are required for guest", 400);
    }
    if (password !== confirmPassword) {throw new AppError("Passwords must match", 400);}
    if (password.length < 6) {throw new AppError("Password must be at least 6 characters", 400);}
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
    guestUser = {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      phone: newUser.phone,
      verified: newUser.isVerified,
      roles: newUser.roles
    };
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
  if (!name) {throw new AppError("Shop name is required", 400);}
  if (!description) {throw new AppError("Shop description is required", 400);}
  if (!category) {throw new AppError("Shop category is required", 400);}

  const idDoc = Array.isArray(files.idDocument) ? files.idDocument[0] : files.idDocument;
  const proofRes = Array.isArray(files.proofOfResidence) ? files.proofOfResidence[0] : files.proofOfResidence;
  const businessCacFile = Array.isArray(files.businessCac) ? files.businessCac[0] : files.businessCac;
  const passportPhoto = Array.isArray(files.passportPhotograph) ? files.passportPhotograph[0] : files.passportPhotograph;
  if (!idDoc || !idDoc.buffer) {throw new AppError("ID document is required", 400);}
  if (!proofRes || !proofRes.buffer) {throw new AppError("Proof of residence is required", 400);}
  if (!businessCacFile || !businessCacFile.buffer) {throw new AppError("Business CAC is required", 400);}
  if (!passportPhoto || !passportPhoto.buffer) {throw new AppError("Passport photograph is required", 400);}

  const foundUser = await User.findById(userId);
  if (!foundUser) {throw new AppError("User not found", 404);}

  const folderDocs = "daw/seller-documents";
  const folderShop = "daw/shops";
  const prefix = `seller_${userId.toString()}`;
  const [idDocResult, proofResResult, cacResult, passportResult] = await Promise.all([
    uploadBuffer(idDoc.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_id` }),
    uploadBuffer(proofRes.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_proof` }),
    uploadBuffer(businessCacFile.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_cac` }),
    uploadBuffer(passportPhoto.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_passport` })
  ]);

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
  const shop = await marketplaceService.createShop(shopData);
  if (!shop) {throw new AppError("Shop not created", 400);}

  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];
  if (!currentRoles.includes("seller")) {currentRoles.push("seller");}
  if (!currentRoles.includes("buyer")) {currentRoles.push("buyer");}
  foundUser.roles = [...new Set(currentRoles)];
  foundUser.shop = shop._id;
  await foundUser.save();

  const sellerDoc = await SellerDocuments.create({
    user_id: userId,
    id_document_url: idDocResult.secure_url,
    proof_of_residence_url: proofResResult.secure_url,
    business_cac_url: cacResult.secure_url,
    passport_photograph_url: passportResult.secure_url,
    status: "pending"
  });

  const member = await MemberService.joinCooperative({
    userId,
    cooperativeId,
    subscriptionTierId
  });

  const isGuest = !req.user || !req.user._id;

  // For logged-in users, return the updated user so frontend can sync roles
  let updatedUser = null;
  if (!isGuest) {
    updatedUser = await User.findById(userId)
      .select("firstName lastName email phone roles isVerified status shop member avatar")
      .populate("shop", "_id name")
      .populate("member", "_id cooperativeId")
      .lean();
  }

  res.status(201).json({
    success: true,
    message: isGuest
      ? "Account created, seller onboarded, and joined cooperative. OTP sent to email for verification."
      : "Seller onboarded and joined cooperative.",
    member,
    shop: { _id: shop._id, name: shop.name, status: shop.status },
    sellerDocuments: { _id: sellerDoc._id, status: sellerDoc.status },
    ...(isGuest ? { token: guestTempToken, user: guestUser } : { user: updatedUser }),
  });
});

/**
 * Guest seller onboard: guest/buyer → create user (if guest) + seller onboard (shop + docs).
 * POST /marketplace/guest-seller-onboard (multipart/form-data)
 * Optional auth: if no token, treat as guest (require firstName, lastName, email, phone, password, confirmPassword).
 * Body: firstName?, lastName?, email?, phone?, password?, confirmPassword? (guest);
 *       name|shopName, description, category, contactNumber?, businessAddress?
 * Files: shopLogo?, shopBanner?, idDocument, proofOfResidence, businessCac, passportPhotograph
 */
const guestSellerOnboard = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const files = req.files || {};
  let userId;
  let guestUser = null;
  let guestTempToken = null;

  if (!req.user || !req.user._id) {
    const { firstName, lastName, email, phone, password, confirmPassword } = body;
    if (!email || !password || !confirmPassword || !firstName || !phone) {
      throw new AppError("email, password, confirmPassword, firstName, and phone are required for guest", 400);
    }
    if (password !== confirmPassword) {throw new AppError("Passwords must match", 400);}
    if (password.length < 6) {throw new AppError("Password must be at least 6 characters", 400);}
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
    guestUser = {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      phone: newUser.phone,
      verified: newUser.isVerified,
      roles: newUser.roles
    };
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
  if (!name) {throw new AppError("Shop name is required", 400);}
  if (!description) {throw new AppError("Shop description is required", 400);}
  if (!category) {throw new AppError("Shop category is required", 400);}

  const idDoc = Array.isArray(files.idDocument) ? files.idDocument[0] : files.idDocument;
  const proofRes = Array.isArray(files.proofOfResidence) ? files.proofOfResidence[0] : files.proofOfResidence;
  const businessCacFile = Array.isArray(files.businessCac) ? files.businessCac[0] : files.businessCac;
  const passportPhoto = Array.isArray(files.passportPhotograph) ? files.passportPhotograph[0] : files.passportPhotograph;
  if (!idDoc || !idDoc.buffer) {throw new AppError("ID document is required", 400);}
  if (!proofRes || !proofRes.buffer) {throw new AppError("Proof of residence is required", 400);}
  if (!businessCacFile || !businessCacFile.buffer) {throw new AppError("Business CAC is required", 400);}
  if (!passportPhoto || !passportPhoto.buffer) {throw new AppError("Passport photograph is required", 400);}

  const foundUser = await User.findById(userId);
  if (!foundUser) {throw new AppError("User not found", 404);}

  const folderDocs = "daw/seller-documents";
  const folderShop = "daw/shops";
  const prefix = `seller_${userId.toString()}`;
  const [idDocResult, proofResResult, cacResult, passportResult] = await Promise.all([
    uploadBuffer(idDoc.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_id` }),
    uploadBuffer(proofRes.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_proof` }),
    uploadBuffer(businessCacFile.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_cac` }),
    uploadBuffer(passportPhoto.buffer, { folder: folderDocs, publicIdPrefix: `${prefix}_passport` })
  ]);

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

  const coopStoreUrl = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Date.now();

  const shopData = {
    owner_id: userId,
    cooperative_id: null,
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
  const shop = await marketplaceService.createShop(shopData);
  if (!shop) {throw new AppError("Shop not created", 400);}

  const currentRoles = Array.isArray(foundUser.roles) ? foundUser.roles : [];
  if (!currentRoles.includes("seller")) {currentRoles.push("seller");}
  if (!currentRoles.includes("buyer")) {currentRoles.push("buyer");}
  foundUser.roles = [...new Set(currentRoles)];
  foundUser.shop = shop._id;
  await foundUser.save();

  const sellerDoc = await SellerDocuments.create({
    user_id: userId,
    id_document_url: idDocResult.secure_url,
    proof_of_residence_url: proofResResult.secure_url,
    business_cac_url: cacResult.secure_url,
    passport_photograph_url: passportResult.secure_url,
    status: "pending"
  });

  const member = await MemberService.joinCooperative({
    userId,
    cooperativeId,
    subscriptionTierId
  });

  const isGuest = !req.user || !req.user._id;
  res.status(201).json({
    success: true,
    message: isGuest
      ? "Account created, seller onboarded, and joined cooperative. OTP sent to email for verification."
      : "Seller onboarded and joined cooperative.",
    member,
    shop: { _id: shop._id, name: shop.name, status: shop.status },
    sellerDocuments: { _id: sellerDoc._id, status: sellerDoc.status },
    ...(isGuest ? { token: guestTempToken, user: guestUser } : {})
  });
});

/**
 * Guest seller onboard: guest/buyer → create user (if guest) + seller onboard (shop + docs).
 * POST /marketplace/guest-seller-onboard (multipart/form-data)
 * Optional auth: if no token, treat as guest (require firstName, lastName, email, phone, password, confirmPassword).
 * Body: firstName?, lastName?, email?, phone?, password?, confirmPassword? (guest);
 *       name|shopName, description, category, contactNumber?, businessAddress?
 * Files: shopLogo?, shopBanner?, idDocument, proofOfResidence, businessCac, passportPhotograph
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
  if (!shop) {return res.status(404).json({ message: "Shop not found" });}
  return res.status(200).json({ success: true, shop });
});

// Create a product (seller/admin)
const createProduct = asyncHandler(async (req, res) => {
  const { shop_id, name, quantity, price, category, description, status, variants, productFeatures, careInstruction, returnPolicy } = req.body;

  if (!shop_id) {
    throw new AppError("Shop ID is required", 400);
  }

  if (!name) {
    throw new AppError("Product name is required", 400);
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
    quantity,
    price,
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
  const { name, quantity, price, category, description, status, variants, productFeatures, careInstruction, returnPolicy, existingImages } = req.body;

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
  if (name !== undefined) {updates.name = name;}
  if (quantity !== undefined) {updates.quantity = Number(quantity);}
  if (price !== undefined) {updates.price = Number(price);}
  if (category !== undefined) {updates.category = category;}
  if (description !== undefined) {updates.description = description;}
  if (status !== undefined) {updates.status = status;}
  if (parsedVariants !== undefined) {updates.variants = parsedVariants;}
  if (productFeatures !== undefined) {updates.productFeatures = productFeatures;}
  if (careInstruction !== undefined) {updates.careInstruction = careInstruction;}
  if (returnPolicy !== undefined) {updates.returnPolicy = returnPolicy;}

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
    const productView = await marketplaceService.getProductById(productId);
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
  const products = await marketplaceService.getProductsByShop(shop_id);
  res.status(200).json({ success: true, products });
});

// Place an order (buyer)
const createOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const buyer_id = req.user._id;

  if (!items || items.length === 0) {
    throw new AppError("Order items are required", 400);
  }

  const { order, orderItems } =
    await marketplaceService.createOrder(buyer_id, items);

  res.status(201).json({
    success: true,
    order,
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
    const products = await marketplaceService.getAllProduct();
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
  getShopStats
};