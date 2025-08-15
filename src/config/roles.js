const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  BUYER: 'buyer', // Changed from USER to BUYER for clarity
};

const PERMISSIONS = {
  // User permissions
  VIEW_ALL_USERS: 'view:all_users',
  MANAGE_USERS: 'manage:users',
  READ_PROFILE: 'read:profile',
  UPDATE_PROFILE: 'update:profile',
  BLOCK_USER: 'block:user',
  ASSIGN_ROLES: 'assign:roles',

  // Product permissions
  CREATE_PRODUCT: 'create:product',
  READ_PRODUCT: 'read:product',
  UPDATE_PRODUCT: 'update:product',
  DELETE_PRODUCT: 'delete:product',
  APPROVE_PRODUCT: 'approve:product',
  REJECT_PRODUCT: 'reject:product',
  VIEW_ALL_PRODUCTS: 'view:all_products',
  VIEW_OWN_PRODUCTS: 'view:own_products',
  MANAGE_CATEGORIES: 'manage:categories',

  // Stock/Inventory permissions
  VIEW_STOCK: 'view:stock',
  MANAGE_STOCK: 'manage:stock',
  VIEW_STOCK_HISTORY: 'view:stock_history',
  ADJUST_STOCK: 'adjust:stock',
  VIEW_LOW_STOCK_ALERTS: 'view:low_stock_alerts',
  EXPORT_STOCK_REPORT: 'export:stock_report',

  // Cart permissions
  MANAGE_CART: 'manage:cart',
  VIEW_ALL_CARTS: 'view:all_carts',
  VIEW_CART_ANALYTICS: 'view:cart_analytics',

  // Order permissions
  CREATE_ORDER: 'create:order',
  READ_ORDER: 'read:order',
  UPDATE_ORDER: 'update:order',
  CANCEL_ORDER: 'cancel:order',
  VIEW_ALL_ORDERS: 'view:all_orders',
  VIEW_OWN_ORDERS: 'view:own_orders',
  DELETE_PROFILE: 'delete:profile',
  VIEW_PENDING_PRODUCTS: 'view:pending_products',
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    // User Management
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    PERMISSIONS.BLOCK_USER,
    PERMISSIONS.ASSIGN_ROLES,

    // Product Management
    PERMISSIONS.VIEW_ALL_PRODUCTS,
    PERMISSIONS.APPROVE_PRODUCT,
    PERMISSIONS.REJECT_PRODUCT,
    PERMISSIONS.UPDATE_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
    PERMISSIONS.MANAGE_CATEGORIES,

    // Stock Management
    PERMISSIONS.VIEW_STOCK,
    PERMISSIONS.MANAGE_STOCK,
    PERMISSIONS.VIEW_STOCK_HISTORY,
    PERMISSIONS.ADJUST_STOCK,
    PERMISSIONS.VIEW_LOW_STOCK_ALERTS,
    PERMISSIONS.EXPORT_STOCK_REPORT,

    // Cart & Analytics
    PERMISSIONS.VIEW_ALL_CARTS,
    PERMISSIONS.VIEW_CART_ANALYTICS,
    PERMISSIONS.VIEW_ALL_ORDERS,
  ],

  [ROLES.SELLER]: [
    // Profile Management
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    PERMISSIONS.DELETE_PROFILE,

    // Product Management
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.READ_PRODUCT,
    PERMISSIONS.UPDATE_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
    PERMISSIONS.VIEW_PENDING_PRODUCTS,

    // Limited Stock Management (own products only)
    PERMISSIONS.VIEW_STOCK,
    PERMISSIONS.VIEW_STOCK_HISTORY,

    // Orders
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.UPDATE_ORDER,
    PERMISSIONS.VIEW_OWN_ORDERS,
  ],

  [ROLES.BUYER]: [
    // Profile Management
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    PERMISSIONS.DELETE_PROFILE,

    // Product Access
    PERMISSIONS.READ_PRODUCT,

    // Cart Management
    PERMISSIONS.MANAGE_CART,

    // Orders
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.CANCEL_ORDER,
    PERMISSIONS.VIEW_OWN_ORDERS,
  ],
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};