const express = require("express");
const { inviteMember } = require("../../controllers/Cooperative/cooperativeInvitation.controller.js");
const { protect, restrictTo } = require("../../middlewares/authMiddleware.js");

const router = express.Router();

// All routes here protected and restricted to cooperative admins (and super admins)
router.use(protect);
router.use(restrictTo("cooperative_admin", "admin"));

router.post("/invite", inviteMember);

module.exports = router;
