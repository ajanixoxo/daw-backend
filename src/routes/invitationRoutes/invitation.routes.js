const express = require("express");
const router = express.Router();
const { validateInvite, completeRegistration } = require("../../controllers/admin/invitation.controller.js");

// Public routes (no auth required)
// GET /api/users/invite/validate/:token
router.get("/validate/:token", validateInvite);

// POST /api/users/invite/complete
router.post("/complete", completeRegistration);

module.exports = router;
