const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('@models/userModel/user.js');
const Cooperative = require('@models/cooperativeModel/cooperative.model.js');
const sendEmail = require('@utils/SendEmail/email.js');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Role to signup URL mapping
const ROLE_SIGNUP_URLS = {
    buyer: '/signup',
    seller: '/sellers-signup',
    member: '/cooperative-signup'
};

/**
 * Invite User (Admin)
 * POST /api/admin/users/invite
 */
const inviteUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, phone, role, notes } = req.body;

    // Validate role
    if (!['buyer', 'seller', 'member'].includes(role)) {
        res.status(400);
        throw new Error('Invalid role. Must be buyer, seller, or member.');
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        res.status(400);
        throw new Error('A user with this email already exists.');
    }

    // Check if phone already exists
    if (phone) {
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            res.status(400);
            throw new Error('A user with this phone number already exists.');
        }
    }

    // Generate secure invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate a random placeholder password (will be replaced on completion)
    const tempPassword = crypto.randomBytes(16).toString('hex');

    // Determine roles array based on selected role
    let roles = [role];
    if (role === 'member') {
        roles = ['member']; // Cooperative member
    }

    // Create the user with invited status
    const newUser = await User.create({
        firstName,
        lastName: lastName || '',
        email: email.toLowerCase(),
        phone: phone || `temp_${Date.now()}`, // Temp phone if not provided (since it's required)
        password: tempPassword,
        roles,
        status: 'invited',
        invitationToken,
        invitationExpires,
        isVerified: true // Skip OTP verification for invited users
    });

    // Build invitation link
    const signupPath = ROLE_SIGNUP_URLS[role] || '/signup';
    const invitationLink = `${FRONTEND_URL}${signupPath}?token=${invitationToken}`;

    // Send invitation email
    const emailSubject = 'You are invited to join DAW Platform';
    const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f10e7c;">Welcome to DAW!</h2>
            <p>Hello ${firstName},</p>
            <p>You have been invited to join the Digital African Women platform as a <strong>${role}</strong>.</p>
            <p>Click the button below to complete your registration:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${invitationLink}" 
                   style="background-color: #f10e7c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                    Complete Registration
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">This invitation link will expire in 7 days.</p>
            <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    `;

    try {
        await sendEmail(email, emailSubject, emailHtml);
    } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't fail the request, user can be resent invitation
    }

    res.status(201).json({
        success: true,
        message: 'Invitation sent successfully',
        data: {
            userId: newUser._id,
            email: newUser.email,
            role,
            invitationLink // Include for testing/debugging, remove in production
        }
    });
});

/**
 * Validate Invitation Token (Public)
 * GET /api/users/invite/validate/:token
 */
const validateInvite = asyncHandler(async (req, res) => {
    const { token } = req.params;

    const user = await User.findOne({
        invitationToken: token,
        invitationExpires: { $gt: new Date() },
        status: 'invited'
    }).select('+invitationToken +invitationExpires');

    if (!user) {
        res.status(404);
        throw new Error('Invalid or expired invitation link.');
    }

    res.status(200).json({
        success: true,
        data: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone && !user.phone.startsWith('temp_') ? user.phone : '',
            roles: user.roles
        }
    });
});

/**
 * Complete Registration (Public)
 * POST /api/users/invite/complete
 */
const completeRegistration = asyncHandler(async (req, res) => {
    const { token, password, phone } = req.body;

    if (!token || !password) {
        res.status(400);
        throw new Error('Token and password are required.');
    }

    if (password.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters.');
    }

    const user = await User.findOne({
        invitationToken: token,
        invitationExpires: { $gt: new Date() },
        status: 'invited'
    }).select('+invitationToken +invitationExpires +password');

    if (!user) {
        res.status(404);
        throw new Error('Invalid or expired invitation link.');
    }

    // Update user
    user.password = password; // Will be hashed by pre-save hook
    user.status = 'active';
    user.invitationToken = undefined;
    user.invitationExpires = undefined;

    // Update phone if provided and current is temp
    if (phone && user.phone.startsWith('temp_')) {
        // Check if phone is unique
        const existingPhone = await User.findOne({ phone, _id: { $ne: user._id } });
        if (existingPhone) {
            res.status(400);
            throw new Error('This phone number is already in use.');
        }
        user.phone = phone;
    }

    await user.save();

    // Generate tokens for auto-login
    const tokens = await user.generateToken();
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Registration completed successfully',
        data: {
            user: {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                roles: user.roles
            },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        }
    });
});

module.exports = {
    inviteUser,
    validateInvite,
    completeRegistration
};
