const express = require("express");
const {
  registerUser,
  verifyEmail,
  resendEmailVerificationOTP,
  login,
  refreshAccessToken,
  loginOTP,
  logout,
  forgotPassword,
  resetPassword,
  getUserProfile
} = require('@controllers/Authentication/auth.js');
const { protect } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post('/register', registerUser);

router.post('/verify/email', protect, verifyEmail);

router.post('/resend/verificatiion', resendEmailVerificationOTP);

router.post('/login', login);

router.post('/login/otp', protect, loginOTP);

router.post('/refresh/token', refreshAccessToken);

router.post('/logout', protect, logout);

router.post('/forgot/password', forgotPassword);

router.post('/reset/password', protect, resetPassword);

router.get('/profile', protect, getUserProfile);

module.exports = router;