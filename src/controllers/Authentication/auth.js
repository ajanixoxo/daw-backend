import user from '../../models/userModel/user.js';
import asyncHandler from 'express-async-handler';
import AppError from '../../utils/Error/AppError.js';
import { verificationEmailTemplate } from '../../utils/EmailTemplate/template.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;


export const registerUser = asyncHandler(async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, phone, role } = req.body;

    if (!firstName || !email || !password || !phone || !role) {
      throw new AppError('All fields are required', 400);
    }

    if (password !== confirmPassword) {
      throw new AppError('Passwords must match', 400);
    }

    const existingUser = await user.findOne({ email });
    if (existingUser) {
      throw new AppError('User already exists', 400);
    }

    const newUser = await user.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      role,
    });

    const { accessToken, refreshToken } = await newUser.generateToken();
    newUser.refreshToken = refreshToken;
    newUser.verificationToken = accessToken;
    await newUser.save();

    const verificationLink = `${FRONTEND_URL}/verify/${accessToken}`;
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
        role: newUser.role,
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


export const verifyEmail = asyncHandler(async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, JWT_SECRET);

    const User = await user.findOne({ email: decoded.email });
    if (!User) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
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


export const resendEmailVerificationLink = asyncHandler(async (req, res) => {
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

    const verificationLink = `${FRONTEND_URL}/verify/${accessToken}`;
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


export const refreshAccessToken = asyncHandler(async (req, res) => {
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


export const login = asyncHandler(async(req,res) => {
  try {
    const { email, password } = req.body;

    if(!email || !password){
      return res.status(400).json({
        message:"All fields are required"
      })
    }

    const User = await user.findOne({ email });
    if(!User){
      throw new AppError("User not found", 404);
    }

    const isMatched = await User.comparePassword(User.password);

    if(!isMatched){
      return res.status(400).json({
        message:"Password is not valid"
      })
    }

    if(!User.isVerified){
      return res.status(400).json({
        message:"please verify your pEmail"
      })
    }

    const { accessToken, refreshToken } = await User.generateToken();

    res.status(200).json({
      message:"loggedIn successful",
      User: User,
      token:{
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    throw new AppError('Internal server error', 500);
  }
})