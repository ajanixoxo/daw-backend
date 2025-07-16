const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  USER: 'user',
};

const PERMISSIONS = {
  // User permissions
  READ_PROFILE: 'read:profile',
  UPDATE_PROFILE: 'update:profile',
  DELETE_PROFILE: 'delete:profile',

  // Product permissions
  CREATE_PRODUCT: 'create:product',
  READ_PRODUCT: 'read:product',
  UPDATE_PRODUCT: 'update:product',
  DELETE_PRODUCT: 'delete:product',

  // Order permissions
  CREATE_ORDER: 'create:order',
  READ_ORDER: 'read:order',
  UPDATE_ORDER: 'update:order',
  CANCEL_ORDER: 'cancel:order',

  // Membership permissions
  CREATE_MEMBERSHIP: 'create:membership',
  READ_MEMBERSHIP: 'read:membership',
  UPDATE_MEMBERSHIP: 'update:membership',
  DELETE_MEMBERSHIP: 'delete:membership',

  // Testimonial permissions
  CREATE_TESTIMONIAL: 'create:testimonial',
  READ_TESTIMONIAL: 'read:testimonial',
  UPDATE_TESTIMONIAL: 'update:testimonial',
  DELETE_TESTIMONIAL: 'delete:testimonial',

  // Cart permissions
  MANAGE_CART: 'manage:cart',
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    ...Object.values(PERMISSIONS), // Admin has all permissions
  ],
  [ROLES.SELLER]: [
    // Profile permissions
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    
    // Product permissions
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.READ_PRODUCT,
    PERMISSIONS.UPDATE_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
    
    // Order permissions
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.UPDATE_ORDER,
    
    // Testimonial permissions
    PERMISSIONS.READ_TESTIMONIAL,
    PERMISSIONS.CREATE_TESTIMONIAL,
    PERMISSIONS.UPDATE_TESTIMONIAL,
  ],
  [ROLES.USER]: [
    // Profile permissions
    PERMISSIONS.READ_PROFILE,
    PERMISSIONS.UPDATE_PROFILE,
    
    // Product permissions
    PERMISSIONS.READ_PRODUCT,
    
    // Order permissions
    PERMISSIONS.CREATE_ORDER,
    PERMISSIONS.READ_ORDER,
    PERMISSIONS.CANCEL_ORDER,
    
    // Cart permissions
    PERMISSIONS.MANAGE_CART,
    
    // Testimonial permissions
    PERMISSIONS.CREATE_TESTIMONIAL,
    PERMISSIONS.READ_TESTIMONIAL,
    PERMISSIONS.UPDATE_TESTIMONIAL,
  ],
};

module.exports = {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
}; 