const express = require("express");
const router = express.Router();
const { inviteUser, validateInvite, completeRegistration } = require("../../controllers/admin/invitation.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

// Admin routes (protected)
// POST /api/admin/users/invite
router.post("/invite", protect, restrictTo("admin"), inviteUser);

module.exports = router;
