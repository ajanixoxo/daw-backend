const User = require('../models/User');
const Product = require('../models/Product');

/**
 * Middleware to check user tier access
 * @param {string[]} allowedTiers - Array of allowed user tiers
 */
const checkTierAccess = (allowedTiers) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Admin users have access to all tiers
      if (req.user.role === 'admin') {
        return next();
      }

      if (!allowedTiers.includes(req.user.userTier)) {
        return res.status(403).json({
          message: `Access restricted. Required tier: ${allowedTiers.join(' or ')}. Your tier: ${req.user.userTier}`,
          code: 'TIER_ACCESS_DENIED',
          currentTier: req.user.userTier,
          requiredTiers: allowedTiers
        });
      }

      next();
    } catch (error) {
      console.error('Tier access error:', error);
      res.status(500).json({ 
        message: 'Tier access validation error',
        code: 'TIER_ACCESS_ERROR'
      });
    }
  };
};

/**
 * Middleware to check if user can add more products based on tier
 */
const checkProductLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin users have unlimited product creation
    if (req.user.role === 'admin') {
      req.userProductCount = 0; // Set to 0 for reference
      return next();
    }

    // Get current product count for the user
    const currentProductCount = await Product.countDocuments({ 
      sellerId: req.user._id,
      status: { $ne: 'rejected' } // Don't count rejected products
    });

    // Check if user can add more products
    if (!req.user.canAddProduct(currentProductCount)) {
      const maxProducts = req.user.tierFeatures.maxProducts;
      return res.status(403).json({
        message: `Product limit reached. Your ${req.user.userTier} tier allows ${maxProducts === -1 ? 'unlimited' : maxProducts} products. You have ${currentProductCount} active products.`,
        code: 'PRODUCT_LIMIT_EXCEEDED',
        currentTier: req.user.userTier,
        maxProducts: maxProducts,
        currentProducts: currentProductCount,
        upgradeRequired: true
      });
    }

    // Add product count to request for reference
    req.userProductCount = currentProductCount;
    next();
  } catch (error) {
    console.error('Product limit check error:', error);
    res.status(500).json({ 
      message: 'Product limit validation error',
      code: 'PRODUCT_LIMIT_ERROR'
    });
  }
};

/**
 * Middleware to check if user has access to analytics features
 */
const checkAnalyticsAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin users have access to all features
  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.tierFeatures.hasAnalytics) {
    return res.status(403).json({
      message: `Analytics access requires premium or cooperative tier. Your current tier: ${req.user.userTier}`,
      code: 'ANALYTICS_ACCESS_DENIED',
      currentTier: req.user.userTier,
      upgradeRequired: true
    });
  }

  next();
};

/**
 * Middleware to check if user has access to loan features
 */
const checkLoanAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin users have access to all features
  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.tierFeatures.hasLoanAccess) {
    return res.status(403).json({
      message: `Loan access requires premium or cooperative tier. Your current tier: ${req.user.userTier}`,
      code: 'LOAN_ACCESS_DENIED',
      currentTier: req.user.userTier,
      upgradeRequired: true
    });
  }

  next();
};

/**
 * Middleware to check if user has access to branding features
 */
const checkBrandingAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin users have access to all features
  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.tierFeatures.hasBranding) {
    return res.status(403).json({
      message: `Branding features require premium or cooperative tier. Your current tier: ${req.user.userTier}`,
      code: 'BRANDING_ACCESS_DENIED',
      currentTier: req.user.userTier,
      upgradeRequired: true
    });
  }

  next();
};

/**
 * Middleware to apply marketplace discount based on user tier
 */
const applyMarketplaceDiscount = (req, res, next) => {
  if (req.user && req.user.tierFeatures.marketplaceDiscount > 0) {
    req.marketplaceDiscount = req.user.tierFeatures.marketplaceDiscount;
  } else {
    req.marketplaceDiscount = 0;
  }
  
  next();
};

/**
 * Middleware to check priority handling access
 */
const checkPriorityAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  // Admin users have access to all features
  if (req.user.role === 'admin') {
    return next();
  }

  if (!req.user.tierFeatures.priorityHandling) {
    return res.status(403).json({
      message: `Priority handling requires premium or cooperative tier. Your current tier: ${req.user.userTier}`,
      code: 'PRIORITY_ACCESS_DENIED',
      currentTier: req.user.userTier,
      upgradeRequired: true
    });
  }

  next();
};

/**
 * Tier-based access patterns for common operations
 */
const tierAccess = {
  // Freemium users only
  freemium: checkTierAccess(['freemium']),
  
  // Premium and cooperative users
  premiumOrCooperative: checkTierAccess(['premium', 'cooperative']),
  
  // Cooperative users only
  cooperative: checkTierAccess(['cooperative']),
  
  // Premium users only
  premium: checkTierAccess(['premium']),
  
  // Any paid tier (premium or cooperative)
  paidTier: checkTierAccess(['premium', 'cooperative']),
  
  // All tiers (essentially no restriction)
  all: checkTierAccess(['freemium', 'premium', 'cooperative'])
};

module.exports = {
  checkTierAccess,
  checkProductLimit,
  checkAnalyticsAccess,
  checkLoanAccess,
  checkBrandingAccess,
  applyMarketplaceDiscount,
  checkPriorityAccess,
  tierAccess,
};

