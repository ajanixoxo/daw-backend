const user = require('@models/userModel/user.js');
const asyncHandler = require('express-async-handler');
const AppError = require('@utils/Error/AppError.js');
const { verificationEmailTemplate } = require('@utils/EmailTemplate/template.js');
const jwt = require('jsonwebtoken');


const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;


 const registerUser = asyncHandler(async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone, roles } = req.body;

    if (!firstName || !email || !password || !phone) {
      throw new AppError('All fields are required', 400);
    }

    if (password !== confirmPassword) {
      throw new AppError('Passwords must match', 400);
    }

    const existingUser = await user.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    // Handle roles: accept array or single string, convert to array
    let userRoles = [];
    if (roles) {
      userRoles = Array.isArray(roles) ? roles : [roles];
    }

    if (userRoles.length === 0) {
      throw new AppError('Roles are required', 400);
    }

    const newUser = await user.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      roles: userRoles,
    });

    const { accessToken, refreshToken } = await newUser.generateToken();
    newUser.refreshToken = refreshToken;
    newUser.verificationToken = accessToken;
    await newUser.save();

    const verificationLink = `${FRONTEND_URL}/auth/verify/email/${accessToken}`;
    await verificationEmailTemplate(newUser.email, newUser.firstName, verificationLink);

    res.status(201).json({
      success: true,
      message: 'Successfully registered. We have sent an email for verification.',
      user: {
        _id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        verified: newUser.isVerified,
        roles: newUser.roles,
      },
      token: {
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Error in registering user:', error.message);
    throw new AppError('Error during register user', 500);
  }
});


 const verifyEmail = asyncHandler(async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, JWT_SECRET);

    const User = await user.findOne({ email: decoded.email });
    if (!User) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    if(User.isVerified){
      return res.status(400).json({
        message:"User already verified"
      })
    }

    User.isVerified = true;
    User.verificationToken = null;
    await User.save();

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Error verifying email:', error.message);
    throw new AppError('Error verifying email', 500);
  }
});


 const resendEmailVerificationLink = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const User = await user.findOne({ email });
    if (!User) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (User.isVerified) {
      return res.status(400).json({ error: 'User already verified.' });
    }

    const { accessToken, refreshToken } = await User.generateToken();
    User.refreshToken = refreshToken;
    User.verificationToken = accessToken;
    await User.save();

    const verificationLink = `${FRONTEND_URL}/auth/verify/email/${accessToken}`;
    await verificationEmailTemplate(User.email, User.firstName, verificationLink);

    res.status(200).json({
      message: 'Verification link sent successfully. Check your email.',
      link: verificationLink
    });
  } catch (error) {
    console.error('Error in resendLink:', error);
    throw new AppError('Internal server error', 500);
  }
});


 const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    const existingUser = await user.findOne({ refreshToken });
    if (!existingUser) {
      throw new AppError('Invalid refresh token', 401);
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const User = await user.findById(decoded._id);

    if (!User) {
      throw new AppError('User not found', 404);
    }

    const { accessToken, refreshToken: newRefreshToken } = await User.generateToken();
    User.refreshToken = newRefreshToken;
    await User.save();

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      token: {
        accessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Error in refreshing access token:', error);
    throw new AppError('Internal server error', 500);
  }
});


 async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "All fields are required" });

    const User = await user.findOne({ email }).select("+password");;
    if (!User) return res.status(404).json({ message: "User not found" });

    const isMatched = await User.comparePassword(password);
    if (!isMatched)
      return res.status(400).json({ message: "Invalid password" });

    if (!User.isVerified)
      return res.status(400).json({ message: "Please verify your email" });

    const { accessToken, refreshToken } = await User.generateToken();

    // Get roles array with backward compatibility
    const userRoles = Array.isArray(User.roles) && User.roles.length > 0 
      ? User.roles 
      : (User.role ? [User.role] : ['buyer']);

    // Prepare user object with roles
    const userResponse = {
      _id: User._id,
      firstName: User.firstName,
      lastName: User.lastName,
      email: User.email,
      phone: User.phone,
      isVerified: User.isVerified,
      roles: userRoles,
      status: User.status,
      kyc_status: User.kyc_status,
      createdAt: User.createdAt,
      updatedAt: User.updatedAt
    };

    res.status(200).json({
      message: "Login successful",
      user: userResponse,
      token: { accessToken, refreshToken },
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  registerUser,
  verifyEmail,
  resendEmailVerificationLink,
  refreshAccessToken,
  login,
};