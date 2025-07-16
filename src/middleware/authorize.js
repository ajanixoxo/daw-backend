const { ROLES } = require('../config/roles');

/**
 * Role-based authorization middleware
 * @param  {...string} roles - Allowed roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }

    if (!req.user.isActive()) {
      return res.status(403).json({ 
        message: 'Your account is not active' 
      });
    }

    next();
  };
};

/**
 * Permission-based authorization middleware
 * @param  {...string} permissions - Required permissions
 */
const authorizePermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.user.isActive()) {
      return res.status(403).json({ 
        message: 'Your account is not active' 
      });
    }

    if (!req.user.hasAllPermissions(permissions)) {
      return res.status(403).json({ 
        message: 'You do not have the required permissions to perform this action' 
      });
    }

    next();
  };
};

/**
 * Resource ownership authorization middleware
 * @param {string} resourceField - Field name containing resource owner ID
 */
const authorizeOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!req.user.isActive()) {
      return res.status(403).json({ 
        message: 'Your account is not active' 
      });
    }

    // Admin can access any resource
    if (req.user.role === ROLES.ADMIN) {
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

module.exports = {
  authorizeRoles,
  authorizePermissions,
  authorizeOwnership,
}; 