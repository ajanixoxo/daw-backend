const { ROLES, PERMISSIONS, ROLE_PERMISSIONS } = require('../config/roles');

/**
 * Combines multiple authorization middlewares
 * @param  {...Function} middlewares - Authorization middlewares to combine
 */
const combineAuthorization = (...middlewares) => {
  return async (req, res, next) => {
    try {
      // Basic auth check
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check if user is active
      if (!req.user.isActive) {
        return res.status(403).json({ 
          message: 'Your account has been blocked' 
        });
      }

      // Execute all middleware checks in sequence
      for (const middleware of middlewares) {
        await new Promise((resolve, reject) => {
          middleware(req, res, (err) => {
            if (err) reject(err);
            resolve();
          });
        });
      }

      next();
    } catch (error) {
      res.status(403).json({ 
        message: error.message || 'Authorization failed' 
      });
    }
  };
};

/**
 * Role-based authorization middleware
 * @param  {...string} roles - Allowed roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access restricted. Required roles: ${roles.join(', ')}` 
      });
    }
    next();
  };
};

/**
 * Permission-based authorization middleware
 * @param {Object} options - Authorization options
 * @param {string[]} options.all - All permissions required
 * @param {string[]} options.any - Any of these permissions required
 */
const authorizePermissions = (options = {}) => {
  return (req, res, next) => {
    const { all = [], any = [] } = options;
    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

    // Check if user has all required permissions
    if (all.length > 0 && !all.every(permission => userPermissions.includes(permission))) {
      return res.status(403).json({ 
        message: `Missing required permissions: ${all.join(', ')}` 
      });
    }

    // Check if user has any of the specified permissions
    if (any.length > 0 && !any.some(permission => userPermissions.includes(permission))) {
      return res.status(403).json({ 
        message: `Need at least one of these permissions: ${any.join(', ')}` 
      });
    }

    next();
  };
};

/**
 * Resource ownership authorization middleware
 * @param {Object} options - Authorization options
 * @param {string} options.resourceField - Field name containing resource owner ID
 * @param {string[]} options.bypassPermissions - Permissions that allow bypassing ownership check
 */
const authorizeOwnership = (options = {}) => {
  const { 
    resourceField = 'userId',
    bypassPermissions = []
  } = options;

  return (req, res, next) => {
    const userPermissions = ROLE_PERMISSIONS[req.user.role] || [];

    // Permission bypass
    if (bypassPermissions.length > 0 && 
        bypassPermissions.some(permission => userPermissions.includes(permission))) {
      return next();
    }

    const resourceId = req.params[resourceField] || req.body[resourceField];
    
    if (!resourceId || resourceId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'You do not have permission to access this resource' 
      });
    }

    next();
  };
};

// Convenience middleware for common authorization patterns
const authorizationPatterns = {
  /**
   * Admin only access
   */
  adminOnly: combineAuthorization(
    authorizeRoles(ROLES.ADMIN)
  ),

  /**
   * Seller access patterns
   */
  sellerAccess: {
    // For managing their own products
    products: combineAuthorization(
      authorizeRoles(ROLES.SELLER),
      authorizeOwnership({ 
        resourceField: 'sellerId',
        bypassPermissions: [PERMISSIONS.VIEW_ALL_PRODUCTS]
      })
    ),
    
    // For viewing their own orders
    orders: combineAuthorization(
      authorizeRoles(ROLES.SELLER),
      authorizePermissions({
        any: [PERMISSIONS.VIEW_OWN_ORDERS]
      })
    )
  },

  /**
   * Buyer access patterns
   */
  buyerAccess: {
    // For managing their own cart
    cart: combineAuthorization(
      authorizeRoles(ROLES.BUYER),
      authorizePermissions({
        all: [PERMISSIONS.MANAGE_CART]
      })
    ),
    
    // For viewing their own orders
    orders: combineAuthorization(
      authorizeRoles(ROLES.BUYER),
      authorizePermissions({
        any: [PERMISSIONS.VIEW_OWN_ORDERS]
      })
    )
  },

  /**
   * Product management patterns
   */
  productAccess: {
    // For viewing products (all roles)
    view: authorizePermissions({
      any: [PERMISSIONS.READ_PRODUCT]
    }),
    
    // For approving/rejecting products (admin only)
    moderate: combineAuthorization(
      authorizeRoles(ROLES.ADMIN),
      authorizePermissions({
        all: [PERMISSIONS.APPROVE_PRODUCT, PERMISSIONS.REJECT_PRODUCT]
      })
    )
  }
};

module.exports = {
  combineAuthorization,
  authorizeRoles,
  authorizePermissions,
  authorizeOwnership,
  authorizationPatterns,
}; 