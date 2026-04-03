const express = require("express");
const router = express.Router();
const { getUserById, updateUser, deleteUser } = require("@controllers/admin/user.controller.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

// All routes are protected
router.use(protect);

// User management routes
router.get("/:id", restrictTo("admin", "support-admin"), getUserById);
router.put("/:id", restrictTo("admin"), updateUser);
router.delete("/:id", restrictTo("admin"), deleteUser);

module.exports = router;
