const express = require("express");
const {
  registerUser,
  verifyEmail,
  resendEmailVerificationOTP,
  login,
  refreshAccessToken,
  loginOTP
} = require('@controllers/Authentication/auth.js');
const { protect } = require("@middlewares/authMiddleware.js");

const router = express.Router();

router.post('/register', registerUser);

router.get('/verify/email', protect, verifyEmail);

router.post('/resend/verificatiion', resendEmailVerificationOTP);

router.post('/login', login);

router.post('/login/otp', protect, loginOTP);

router.post('/refresh/token', refreshAccessToken);

module.exports = router;