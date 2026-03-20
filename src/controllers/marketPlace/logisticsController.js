const Order = require("@models/marketPlace/orderModel.js");
const OrderItem = require("@models/marketPlace/orderItemModel.js");
const LogisticsProvider = require("@models/marketPlace/logisticsProviderModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Shop = require("@models/marketPlace/shopModel.js");

// Helper: get logistics provider id for the currently logged-in user
const getProviderForUser = async (userId) => {
  const provider = await LogisticsProvider.findOne({ user_id: userId });
  if (!provider) return null;
  return provider;
};

// GET /api/logistics/deliveries?status=all|in_transit|delivered|pending
exports.getMyDeliveries = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user._id);
    if (!provider) {
      return res.status(403).json({ success: false, message: "Not a registered logistics provider" });
    }

    const { status } = req.query;
    const filter = { logistics_id: provider._id };
    if (status && status !== "all") {
      filter.status = status;
    }

    const orders = await Order.find(filter)
      .populate("buyer_id", "firstName lastName email phone")
      .populate({
        path: "shop_id",
        select: "name business_address"
      })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich with order items
    for (const order of orders) {
      const items = await OrderItem.find({ order_id: order._id })
        .populate({ path: "product_id", select: "name images" })
        .lean();
      order.items = items;
    }

    return res.status(200).json({
      success: true,
      message: "Deliveries fetched successfully",
      data: orders,
    });
  } catch (error) {
    console.error("Error fetching deliveries:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch deliveries", error: error.message });
  }
};

// PATCH /api/logistics/deliveries/:orderId/status
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user._id);
    if (!provider) {
      return res.status(403).json({ success: false, message: "Not a registered logistics provider" });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["in_transit", "delivered"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const order = await Order.findOne({ _id: orderId, logistics_id: provider._id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });
    }

    order.status = status;
    await order.save();

    return res.status(200).json({ success: true, message: "Delivery status updated", data: order });
  } catch (error) {
    console.error("Error updating delivery status:", error);
    return res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
  }
};

// GET /api/logistics/earnings
exports.getMyEarnings = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user._id);
    if (!provider) {
      return res.status(403).json({ success: false, message: "Not a registered logistics provider" });
    }

    const deliveredOrders = await Order.find({
      logistics_id: provider._id,
      status: "delivered",
    }).lean();

    const totalDeliveries = deliveredOrders.length;
    // Logistics provider earns the exact flat delivery fee applied to the order
    
    let totalEarnings = 0;
    const monthlyMap = {};

    for (const order of deliveredOrders) {
      const fee = order.delivery_fee || 0;
      totalEarnings += fee;

      const month = new Date(order.updatedAt).toLocaleString("default", { month: "short", year: "numeric" });
      monthlyMap[month] = (monthlyMap[month] || 0) + fee;
    }

    const avgPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
    const platformFee = totalEarnings * 0.10; // e.g. platform takes a 10% commission on the delivery
    const netEarnings = totalEarnings - platformFee;

    // Active (pending payout) — deliveries in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEarnings = deliveredOrders
      .filter((o) => new Date(o.updatedAt) > sevenDaysAgo)
      .reduce((sum, o) => sum + (o.delivery_fee || 0), 0);

    const monthlyChart = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

    return res.status(200).json({
      success: true,
      message: "Earnings fetched successfully",
      data: {
        totalEarnings,
        netEarnings,
        platformFee,
        avgPerDelivery,
        pendingPayout: recentEarnings,
        totalDeliveries,
        monthlyChart,
      },
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch earnings", error: error.message });
  }
};

// GET /api/logistics/stats
exports.getMyStats = async (req, res) => {
  try {
    const provider = await getProviderForUser(req.user._id);
    if (!provider) {
      return res.status(403).json({ success: false, message: "Not a registered logistics provider" });
    }

    const [total, active, pending, delivered] = await Promise.all([
      Order.countDocuments({ logistics_id: provider._id }),
      Order.countDocuments({ logistics_id: provider._id, status: "in_transit" }),
      Order.countDocuments({ logistics_id: provider._id, status: "pending" }),
      Order.countDocuments({ logistics_id: provider._id, status: "delivered" }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Stats fetched successfully",
      data: {
        totalShipments: total,
        activeShipments: active,
        pendingRequests: pending,
        completedDeliveries: delivered,
        rating: 4.8, // Placeholder until we add a ratings system
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch stats", error: error.message });
  }
};
