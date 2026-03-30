const Order = require("@models/marketPlace/orderModel.js");
const OrderItem = require("@models/marketPlace/orderItemModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Shop = require("@models/marketPlace/shopModel.js");
const User = require("@models/userModel/user.js");
const { orderStatusBuyerEmailTemplate, orderStatusSellerEmailTemplate } = require("@utils/EmailTemplate/template.js");

// GET /api/logistics/deliveries?status=all|in_transit|delivered|pending
exports.getMyDeliveries = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {}; // Unified internal service: all providers see all relevant orders
    if (status && status !== "all") {
      filter.status = status;
    } else {
      // Default: show orders that need attention (processing, in_transit) or recently delivered
      filter.status = { $in: ["processing", "in_transit", "delivered"] };
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
    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["in_transit", "delivered"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found or not assigned to you" });
    }

    order.status = status;
    order.status_history.push({
      status: status,
      note: "Updated by Logistics Provider"
    });
    await order.save();

    // Send notifications to buyer and seller asynchronously
    try {
      const buyer = await User.findById(order.buyer_id);
      
      const shop = await Shop.findById(order.shop_id).populate("owner_id");
      const seller = shop && shop.owner_id ? shop.owner_id : null;
      
      const emailPromises = [];
      if (buyer && buyer.email) {
        emailPromises.push(orderStatusBuyerEmailTemplate(buyer.email, buyer.firstName, order._id, status));
      }
      if (seller && seller.email) {
        emailPromises.push(orderStatusSellerEmailTemplate(seller.email, seller.firstName, order._id, status));
      }
      
      // Fire notifications without throwing on failure
      Promise.allSettled(emailPromises).catch(console.error);
    } catch (notifyError) {
      console.error("Error sending order status notifications:", notifyError);
    }    
    //release scrow too
    if (status === "delivered") {
        const shop = await Shop.findById(order.shop_id);
        if (!shop) {
          throw new AppError("Shop not found for this order", 404);
        }
    
        const seller = await User.findById(shop.owner_id);
        if (!seller) {
          throw new AppError("Seller not found", 404);
        }
    
        // Move funds from pending to account_Balance (Available)
        // seller.pending_amount should have been increased by verifyPayment
        const amountToTransfer = order.total_amount;
    
        seller.pending_amount = Math.max(0, (seller.pending_amount || 0) - amountToTransfer);
        seller.account_Balance = (seller.account_Balance || 0) + amountToTransfer;
    
        order.escrow_status = "released";
    
        await seller.save();
        console.log(`Funds released for order ${orderId}: ${amountToTransfer} moved to seller ${seller._id} available balance.`);
      }

    return res.status(200).json({ success: true, message: "Delivery status updated", data: order });
  } catch (error) {
    console.error("Error updating delivery status:", error);
    return res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
  }
};

// GET /api/logistics/earnings
exports.getMyEarnings = async (req, res) => {
  try {
    const deliveredOrders = await Order.find({
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
    const [total, active, pending, delivered] = await Promise.all([
      Order.countDocuments({ status: { $in: ["processing", "in_transit", "delivered"] } }),
      Order.countDocuments({ status: "in_transit" }),
      Order.countDocuments({ status: "processing" }), // 'processing' is now equivalent to pending pickup
      Order.countDocuments({ status: "delivered" }),
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
