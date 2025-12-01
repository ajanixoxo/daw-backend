const user = require('@models/userModel/user.js');
const asyncHandler = require('express-async-handler');
const AppError = require('@utils/Error/AppError.js');

/**
 * Upgrade user to seller role
 * PATCH /users/:id/upgrade/seller
 */
const upgradeToSeller = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const User = await user.findById(id);
    if (!User) {
      throw new AppError('User not found', 404);
    }

    // Get current roles array with backward compatibility
    let currentRoles = Array.isArray(User.roles) && User.roles.length > 0 
      ? User.roles 
      : (User.role ? [User.role] : ['buyer']);

    // Only add "seller" if it's not already present
    if (!currentRoles.includes('seller')) {
      currentRoles.push('seller');
      User.roles = currentRoles;
      await User.save();
    }

    res.status(200).json({
      success: true,
      message: 'User upgraded to seller successfully',
      user: {
        _id: User._id,
        firstName: User.firstName,
        lastName: User.lastName,
        email: User.email,
        roles: User.roles
      }
    });
  } catch (error) {
    console.error('Error upgrading user to seller:', error.message);
    throw new AppError(error.message || 'Error upgrading user to seller', error.statusCode || 500);
  }
});

/**
 * Upgrade user to cooperative role
 * PATCH /users/:id/upgrade/cooperative
 */
const upgradeToCooperative = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const User = await user.findById(id);
    if (!User) {
      throw new AppError('User not found', 404);
    }

    // Get current roles array with backward compatibility
    let currentRoles = Array.isArray(User.roles) && User.roles.length > 0 
      ? User.roles 
      : (User.role ? [User.role] : ['buyer']);

    // Only add "cooperative" if it's not already present
    if (!currentRoles.includes('cooperative')) {
      currentRoles.push('cooperative');
      User.roles = currentRoles;
      await User.save();
    }

    res.status(200).json({
      success: true,
      message: 'User upgraded to cooperative successfully',
      user: {
        _id: User._id,
        firstName: User.firstName,
        lastName: User.lastName,
        email: User.email,
        roles: User.roles
      }
    });
  } catch (error) {
    console.error('Error upgrading user to cooperative:', error.message);
    throw new AppError(error.message || 'Error upgrading user to cooperative', error.statusCode || 500);
  }
});

module.exports = {
  upgradeToSeller,
  upgradeToCooperative
};

