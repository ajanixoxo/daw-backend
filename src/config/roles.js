const ROLES = {
  ADMIN: 'admin',
  COOPERATIVE_ADMIN: 'cooperative_admin',
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
  TRACK_ORDER: 'track:order',
  REQUEST_RETURN: 'request:return',
  REQUEST_REFUND: 'request:refund',
  VIEW_INVOICES: 'view:invoices',
  DELETE_PROFILE: 'delete:profile',
  VIEW_PENDING_PRODUCTS: 'view:pending_products',

  // Browse & Discovery permissions
  BROWSE_PRODUCTS: 'browse:products',
  SEARCH_PRODUCTS: 'search:products',
  FILTER_PRODUCTS: 'filter:products',
  VIEW_CATEGORIES: 'view:categories',
  VIEW_SELLER_PROFILES: 'view:seller_profiles',
  VIEW_COOPERATIVE_PROFILES: 'view:cooperative_profiles',

  // Shopping Cart permissions (extended)
  ADD_TO_CART: 'add:to_cart',
  REMOVE_FROM_CART: 'remove:from_cart',
  UPDATE_CART_QUANTITY: 'update:cart_quantity',
  APPLY_COUPONS: 'apply:coupons',
  SAVE_FOR_LATER: 'save:for_later',
  MANAGE_WISHLIST: 'manage:wishlist',
  CHECKOUT_MULTI_SELLER: 'checkout:multi_seller',

  // Payment permissions
  PAY_WITH_WALLET: 'pay:with_wallet',
  PAY_WITH_MOBILE_MONEY: 'pay:with_mobile_money',
  PAY_WITH_CARD: 'pay:with_card',
  PAY_WITH_BANK_TRANSFER: 'pay:with_bank_transfer',

  // Feedback & Community permissions
  LEAVE_PRODUCT_REVIEWS: 'leave:product_reviews',
  RATE_SELLERS: 'rate:sellers',
  RATE_COOPERATIVES: 'rate:cooperatives',
  JOIN_COMMUNITY_FORUMS: 'join:community_forums',
  ACCESS_MENTORSHIP: 'access:mentorship',
  SHARE_PRODUCTS: 'share:products',
  REFER_STORES: 'refer:stores',

  // Account Management permissions (extended)
  MANAGE_ADDRESSES: 'manage:addresses',
  MANAGE_WALLET: 'manage:wallet',
  TOP_UP_WALLET: 'top_up:wallet',
  WITHDRAW_FROM_WALLET: 'withdraw:from_wallet',
  VIEW_WALLET_TRANSACTIONS: 'view:wallet_transactions',
  ACCESS_MEMBER_BENEFITS: 'access:member_benefits',
  ACCESS_MEMBER_DISCOUNTS: 'access:member_discounts',
  ACCESS_TRAINING_INVITES: 'access:training_invites',
  ACCESS_LOAN_ELIGIBILITY: 'access:loan_eligibility',

  // Masterclass permissions
  CREATE_MASTERCLASS: 'create:masterclass',
  READ_MASTERCLASS: 'read:masterclass',
  UPDATE_MASTERCLASS: 'update:masterclass',
  DELETE_MASTERCLASS: 'delete:masterclass',
  VIEW_ALL_MASTERCLASSES: 'view:all_masterclasses',
  VIEW_OWN_MASTERCLASSES: 'view:own_masterclasses',

  // Payment permissions
  CREATE_PAYMENT: 'create:payment',
  VIEW_OWN_PAYMENTS: 'view:own_payments',
  VIEW_ALL_PAYMENTS: 'view:all_payments',
  PROCESS_REFUNDS: 'process:refunds',
  VIEW_PAYMENT_STATS: 'view:payment_stats',
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

    // Masterclass Management (Full Access)
    PERMISSIONS.CREATE_MASTERCLASS,
    PERMISSIONS.READ_MASTERCLASS,
    PERMISSIONS.UPDATE_MASTERCLASS,
    PERMISSIONS.DELETE_MASTERCLASS,
    PERMISSIONS.VIEW_ALL_MASTERCLASSES,

    // Payment Management (Full Access)
    PERMISSIONS.VIEW_ALL_PAYMENTS,
    PERMISSIONS.PROCESS_REFUNDS,
    PERMISSIONS.VIEW_PAYMENT_STATS,
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

  [ROLES.COOPERATIVE_ADMIN]: [
    // User Management (limited)
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    PERMISSIONS.BLOCK_USER,

    // Product Management (cooperative products)
    PERMISSIONS.VIEW_ALL_PRODUCTS,
    PERMISSIONS.APPROVE_PRODUCT,
    PERMISSIONS.REJECT_PRODUCT,
    PERMISSIONS.UPDATE_PRODUCT,
    PERMISSIONS.VIEW_PENDING_PRODUCTS,

    // Stock Management (cooperative inventory)
    PERMISSIONS.VIEW_STOCK,
    PERMISSIONS.MANAGE_STOCK,
    PERMISSIONS.VIEW_STOCK_HISTORY,
    PERMISSIONS.ADJUST_STOCK,
    PERMISSIONS.VIEW_LOW_STOCK_ALERTS,

    // Cart & Order Management
    PERMISSIONS.VIEW_ALL_CARTS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.UPDATE_ORDER,

    // Masterclass Management (Cooperative Level)
    PERMISSIONS.CREATE_MASTERCLASS,
    PERMISSIONS.READ_MASTERCLASS,
    PERMISSIONS.UPDATE_MASTERCLASS,
    PERMISSIONS.DELETE_MASTERCLASS,
    PERMISSIONS.VIEW_OWN_MASTERCLASSES,
  ],

  [ROLES.BUYER]: [
    // Profile Management
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    PERMISSIONS.DELETE_PROFILE,
    PERMISSIONS.MANAGE_ADDRESSES,

    // Browse & Discovery
    PERMISSIONS.BROWSE_PRODUCTS,
    PERMISSIONS.SEARCH_PRODUCTS,
    PERMISSIONS.FILTER_PRODUCTS,
    PERMISSIONS.VIEW_CATEGORIES,
    PERMISSIONS.VIEW_SELLER_PROFILES,
    PERMISSIONS.VIEW_COOPERATIVE_PROFILES,
    PERMISSIONS.READ_PRODUCT,

    // Shopping Cart (comprehensive)
    PERMISSIONS.MANAGE_CART,
    PERMISSIONS.ADD_TO_CART,
    PERMISSIONS.REMOVE_FROM_CART,
    PERMISSIONS.UPDATE_CART_QUANTITY,
    PERMISSIONS.APPLY_COUPONS,
    PERMISSIONS.SAVE_FOR_LATER,
    PERMISSIONS.MANAGE_WISHLIST,
    PERMISSIONS.CHECKOUT_MULTI_SELLER,

    // Orders & Tracking
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.TRACK_ORDER,
    PERMISSIONS.CANCEL_ORDER,
    PERMISSIONS.REQUEST_RETURN,
    PERMISSIONS.REQUEST_REFUND,
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.VIEW_INVOICES,

    // Payment Methods
    PERMISSIONS.PAY_WITH_WALLET,
    PERMISSIONS.PAY_WITH_MOBILE_MONEY,
    PERMISSIONS.PAY_WITH_CARD,
    PERMISSIONS.PAY_WITH_BANK_TRANSFER,

    // Feedback & Community
    PERMISSIONS.LEAVE_PRODUCT_REVIEWS,
    PERMISSIONS.RATE_SELLERS,
    PERMISSIONS.RATE_COOPERATIVES,
    PERMISSIONS.JOIN_COMMUNITY_FORUMS,
    PERMISSIONS.ACCESS_MENTORSHIP,
    PERMISSIONS.SHARE_PRODUCTS,
    PERMISSIONS.REFER_STORES,

    // Wallet Management
    PERMISSIONS.MANAGE_WALLET,
    PERMISSIONS.TOP_UP_WALLET,
    PERMISSIONS.WITHDRAW_FROM_WALLET,
    PERMISSIONS.VIEW_WALLET_TRANSACTIONS,

    // Cooperative Member Benefits (if applicable)
    PERMISSIONS.ACCESS_MEMBER_BENEFITS,
    PERMISSIONS.ACCESS_MEMBER_DISCOUNTS,
    PERMISSIONS.ACCESS_TRAINING_INVITES,
    PERMISSIONS.ACCESS_LOAN_ELIGIBILITY,

    // Masterclass Access (Buyer Level)
    PERMISSIONS.READ_MASTERCLASS,

    // Payment Access (Buyer Level)
    PERMISSIONS.CREATE_PAYMENT,
    PERMISSIONS.VIEW_OWN_PAYMENTS,
  ],
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};