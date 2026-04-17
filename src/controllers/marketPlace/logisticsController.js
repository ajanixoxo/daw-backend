const Order = require("@models/marketPlace/orderModel.js");
const OrderItem = require("@models/marketPlace/orderItemModel.js");
const Product = require("@models/marketPlace/productModel.js");
const Shop = require("@models/marketPlace/shopModel.js");
const User = require("@models/userModel/user.js");
const Withdrawal = require("@models/walletLedger/withdrawalModel.js");
const { orderStatusBuyerEmailTemplate, orderStatusSellerEmailTemplate } = require("@utils/EmailTemplate/template.js");

// GET /api/logistics/deliveries?status=all|in_transit|delivered|pending
exports.getMyDeliveries = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {
      $or: [
        { logistics_id: req.user._id }, // Orders assigned to me
        { logistics_id: { $exists: false }, status: "processing" }, // Available for pickup
        { logistics_id: null, status: "processing" }
      ]
    };

    if (status && status !== "all") {
      filter.status = status;
    } else {
      filter.status = { $in: ["processing", "in_transit", "delivered"] };
    }

    const orders = await Order.find(filter)
      .populate("buyer_id", "firstName lastName email phone")
      .populate({
        path: "shop_id",
        select: "name business_address owner_id",
        populate: {
          path: "owner_id",
          select: "firstName lastName phone email"
        }
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

    const originalStatus = order.status;
    
    // GUARD: Prevent moving a delivered order back to in_transit
    if (originalStatus === "delivered" && status === "in_transit") {
      return res.status(400).json({ success: false, message: "Order is already delivered and cannot be moved back to in-transit." });
    }

    order.status = status;
    order.status_history.push({
      status: status,
      note: "Updated by Logistics Provider"
    });

    // --- LOGISTICS PROVIDER ASSIGNMENT & FINANCIAL LOGIC ---
    if (status === "in_transit") {
      // Assign the provider if not already assigned
      if (!order.logistics_id) {
        order.logistics_id = req.user._id;
      }
      
      // If we just assigned them (or they were already assigned but hadn't been credited pending yet)
      // Note: We only credit pending if moving FROM pending/processing TO in_transit
      if (originalStatus === "pending" || originalStatus === "processing") {
        const provider = await User.findById(req.user._id);
        if (provider) {
          provider.pending_amount = (provider.pending_amount || 0) + (order.delivery_fee || 0);
          await provider.save();
          console.log(`Credited delivery fee ${order.delivery_fee} to provider ${req.user._id} pending amount.`);
        }
      }
    }

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
    // GUARD: Only release funds if moving TO delivered FROM something else
    if (status === "delivered" && originalStatus !== "delivered") {
        const shop = await Shop.findById(order.shop_id);
        if (!shop) {
          throw new AppError("Shop not found for this order", 404);
        }
    
        const seller = await User.findById(shop.owner_id);
        if (seller) {
           // Move funds from pending to account_Balance (Available) for SELLER
           const sellerAmount = order.total_amount - (order.delivery_fee || 0); // Seller doesn't get delivery fee
           seller.pending_amount = Math.max(0, (seller.pending_amount || 0) - sellerAmount);
           seller.account_Balance = (seller.account_Balance || 0) + sellerAmount;
           await seller.save();
           console.log(`Funds released for seller ${seller._id}: ${sellerAmount} moved to available balance.`);
        }

        // --- LOGISTICS PROVIDER PAYOUT ---
        if (order.logistics_id) {
          const provider = await User.findById(order.logistics_id);
          if (provider) {
            const fee = order.delivery_fee || 0;
            provider.pending_amount = Math.max(0, (provider.pending_amount || 0) - fee);
            provider.account_Balance = (provider.account_Balance || 0) + fee;
            await provider.save();
            console.log(`Delivery fee released for provider ${provider._id}: ${fee} moved to available balance.`);
          }
        }
    
        order.escrow_status = "released";
        await order.save();
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
      $or: [
        { logistics_id: req.user._id },
        { logistics_id: { $exists: false } },
        { logistics_id: null }
      ],
      status: "delivered",
    }).lean();

    const pendingOrders = await Order.find({
      logistics_id: req.user._id,
      status: { $in: ["processing", "in_transit"] }
    }).lean();

    const totalDeliveries = deliveredOrders.length;
    
    let totalEarnings = 0;
    const monthlyMap = {};

    for (const order of deliveredOrders) {
      const fee = order.delivery_fee || 0;
      totalEarnings += fee;

      const month = new Date(order.updatedAt).toLocaleString("default", { month: "short", year: "numeric" });
      monthlyMap[month] = (monthlyMap[month] || 0) + fee;
    }

    const pendingPayout = pendingOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);

    const avgPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
    const platformFee = totalEarnings * 0.10; // e.g. platform takes a 10% commission on the delivery
    const netEarnings = totalEarnings - platformFee;

    // Active (pending payout) — deliveries in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEarnings = deliveredOrders
      .filter((o) => new Date(o.updatedAt) > sevenDaysAgo)
      .reduce((sum, o) => sum + (o.delivery_fee || 0), 0);

    const monthlyChart = Object.entries(monthlyMap).map(([month, amount]) => ({ month, amount }));

    // --- SHARED WALLET LOGIC ---
    // Calculate global pool: Total of all delivered fees ever - Total of all approved withdrawals
    const totalWithdrawn = await Withdrawal.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const withdrawnAmount = totalWithdrawn.length > 0 ? totalWithdrawn[0].total : 0;
    
    // We already have deliveredOrders from the current user (and fallback).
    // But to be truly global, we should sum all delivered orders in the system
    const allDeliveredOrders = await Order.find({ status: "delivered" }).select("delivery_fee").lean();
    const totalGlobalFees = allDeliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);
    
    const sharedBalance = Math.max(0, totalGlobalFees - withdrawnAmount);

    return res.status(200).json({
      success: true,
      message: "Earnings fetched successfully",
      data: {
        totalEarnings,
        netEarnings,
        platformFee,
        avgPerDelivery,
        pendingPayout,
        totalDeliveries,
        monthlyChart,
        sharedBalance, // New synchronized balance
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
    const providerId = req.user._id;
    const [total, active, pending, delivered] = await Promise.all([
      Order.countDocuments({ logistics_id: providerId }),
      Order.countDocuments({ logistics_id: providerId, status: "in_transit" }),
      Order.countDocuments({ logistics_id: { $exists: false }, status: "processing" }), // Available for pickup
      Order.countDocuments({ 
        $or: [
          { logistics_id: providerId },
          { logistics_id: { $exists: false } },
          { logistics_id: null }
        ],
        status: "delivered" 
      }),
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
