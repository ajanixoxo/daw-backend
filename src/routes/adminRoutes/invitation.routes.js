const express = require('express');
const router = express.Router();
const { inviteUser, validateInvite, completeRegistration } = require('../../controllers/admin/invitation.controller.js');

// Admin routes (protected - add auth middleware in main app)
// POST /api/admin/users/invite
router.post('/invite', inviteUser);

module.exports = router;
