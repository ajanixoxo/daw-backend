const express = require("express");
const router = express.Router();
const logisticsController = require("@controllers/marketPlace/logisticsController.js");
const { protect, restrictTo } = require("@middlewares/authMiddleware.js");

// All logistics routes require authentication and logistics_provider role
router.use(protect, restrictTo("logistics_provider"));

router.get("/deliveries", logisticsController.getMyDeliveries);
router.patch("/deliveries/:orderId/status", logisticsController.updateDeliveryStatus);
router.get("/earnings", logisticsController.getMyEarnings);
router.get("/stats", logisticsController.getMyStats);

module.exports = router;
