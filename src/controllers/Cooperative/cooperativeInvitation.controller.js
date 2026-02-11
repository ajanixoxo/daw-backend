const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../../models/userModel/user.js');
const sendEmail = require('../../utils/SendEmail/email.js');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Invite a member (Seller or Admin) to the cooperative
 * POST /api/cooperative/invite
 * Access: Cooperative Admin, Admin
 */
const inviteMember = asyncHandler(async (req, res) => {
    const { email, role, firstName, lastName, phone } = req.body;

    // Validate required fields
    if (!email || !role || !firstName) {
        res.status(400);
        throw new Error('Email, role, and first name are required');
    }

    // Validate role
    if (!['seller', 'admin'].includes(role)) {
        res.status(400);
        throw new Error('Invalid role. Must be seller or admin.');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
        res.status(400);
        throw new Error('A user with this email already exists.');
    }
    
    // Check phone uniqueness if provided
    if (phone) {
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
             res.status(400);
             throw new Error('A user with this phone number already exists.');
        }
    }

    // Generate random password
    const generatedPassword = crypto.randomBytes(8).toString('hex'); // 16 chars

    // Admin Flow
    if (role === 'admin') {
        const newUser = await User.create({
            firstName,
            lastName: lastName || '',
            email: email.toLowerCase(),
            phone: phone || `temp_${Date.now()}`,
            password: generatedPassword,
            roles: ['cooperative_admin'], // Grants admin access
            status: 'active',
            isVerified: true
        });

        // Send credentials email
        const emailSubject = 'Your Cooperative Admin Account Credentials';
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f10e7c;">Welcome to DAW!</h2>
                <p>Hello ${firstName},</p>
                <p>You have been invited to join the Digital African Women platform as a <strong>Cooperative Admin</strong>.</p>
                <p>Your account has been created successfully. You can log in with the following credentials:</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Password:</strong> ${generatedPassword}</p>
                </div>
                <p>Please log in and change your password immediately.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${FRONTEND_URL}/login" 
                       style="background-color: #f10e7c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                        Login to Dashboard
                    </a>
                </div>
            </div>
        `;

        try {
             await sendEmail(email, emailSubject, emailHtml);
        } catch (error) {
            console.error('Failed to send admin invite email:', error);
            // We don't rollback user creation, but we should notify admin (maybe in response message)
        }

        return res.status(201).json({
            success: true,
            message: 'Admin invitation sent successfully',
            data: { userId: newUser._id, email: newUser.email, role: 'admin' }
        });
    }

    // Seller Flow
    if (role === 'seller') {
        const invitationToken = crypto.randomBytes(32).toString('hex');
        const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const newUser = await User.create({
            firstName,
            lastName: lastName || '',
            email: email.toLowerCase(),
            phone: phone || `temp_${Date.now()}`,
            password: generatedPassword, // Temporary password, will set own on signup
            roles: ['seller'],
            status: 'invited',
            invitationToken,
            invitationExpires,
            isVerified: false
        });

        // Send invite link
        const inviteLink = `${FRONTEND_URL}/sellers/sellers-signup?token=${invitationToken}&email=${encodeURIComponent(email)}`;
        
        const emailSubject = 'Invitation to join DAW as a Seller';
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f10e7c;">Welcome to DAW!</h2>
                <p>Hello ${firstName},</p>
                <p>You have been invited to join the Digital African Women platform as a <strong>Seller</strong>.</p>
                <p>Please click the button below to complete your registration and set up your shop:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" 
                       style="background-color: #f10e7c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                        Complete Registration
                    </a>
                </div>
                <p style="color: #666; font-size: 14px;">This link expires in 7 days.</p>
            </div>
        `;

        try {
             await sendEmail(email, emailSubject, emailHtml);
        } catch (error) {
             console.error('Failed to send seller invite email:', error);
        }

        return res.status(201).json({
            success: true,
            message: 'Seller invitation sent successfully',
            data: { userId: newUser._id, email: newUser.email, role: 'seller', inviteLink } // omit link in prod usually
        });
    }
});

module.exports = {
    inviteMember
};
