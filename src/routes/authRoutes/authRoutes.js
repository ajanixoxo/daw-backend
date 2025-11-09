const express = require("express");
const {
  registerUser,
  verifyEmail,
  resendEmailVerificationLink,
  login,
  refreshAccessToken
} = require('@controllers/Authentication/auth.js');


const router = express.Router();

router.post('/register', registerUser);

router.get('/verify/email/:token', verifyEmail);

router.post('/resend/verificatiion/link', resendEmailVerificationLink);

router.post('/login', login);

router.post('/refresh/token', refreshAccessToken);

module.exports = router;