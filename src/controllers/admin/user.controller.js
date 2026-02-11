const asyncHandler = require('express-async-handler');
const User = require('@models/userModel/user.js');

/**
 * Get User by ID (Admin)
 * GET /api/admin/users/:id
 */
const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id)
        .select('-password -refreshToken -invitationToken')
        .populate('shop', 'name')
        .populate('cooperative', 'name');

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    res.status(200).json({
        success: true,
        data: user
    });
});

/**
 * Update User (Admin)
 * PUT /api/admin/users/:id
 */
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phone, roles, status } = req.body;

    const user = await User.findById(id);

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
        const existingEmail = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
        if (existingEmail) {
            res.status(400);
            throw new Error('Email is already in use by another user.');
        }
        user.email = email.toLowerCase();
    }

    // Check if phone is being changed and if it's already taken
    if (phone && phone !== user.phone) {
        const existingPhone = await User.findOne({ phone, _id: { $ne: id } });
        if (existingPhone) {
            res.status(400);
            throw new Error('Phone number is already in use by another user.');
        }
        user.phone = phone;
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (roles && Array.isArray(roles)) user.roles = roles;
    if (status) user.status = status;

    await user.save();

    res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            roles: user.roles,
            status: user.status
        }
    });
});

/**
 * Delete User (Admin) - Soft delete
 * DELETE /api/admin/users/:id
 */
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }

    // Hard delete - remove user from database
    await user.deleteOne();

    res.status(200).json({
        success: true,
        message: 'User deleted successfully'
    });
});

module.exports = {
    getUserById,
    updateUser,
    deleteUser
};
