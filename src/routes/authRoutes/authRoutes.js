import express from 'express';
import {
    registerUser,
    verifyEmail,
    resendEmailVerificationLink
} from '../../controllers/Authentication/auth.js';

const router = express.Router();

router.post('/register', registerUser);

router.post('/verify/email/:token', verifyEmail);

router.post('/resend/verificatiion/link', resendEmailVerificationLink);

export default router;