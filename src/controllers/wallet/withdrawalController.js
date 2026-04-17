const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Withdrawal = require("@models/walletLedger/withdrawalModel.js");
const User = require("@models/userModel/user.js");
const WalletLedger = require("@models/walletLedger/ledger.js");
const AppError = require("@utils/Error/AppError.js");
const Order = require("@models/marketPlace/orderModel.js");

// Helper to calculate Shared Logistics Pool Balance
const getLogisticsSharedBalance = async () => {
  // 1. Sum all delivered delivery fees in the system
  const allDeliveredOrders = await Order.find({ status: "delivered" }).select("delivery_fee").lean();
  const totalFees = allDeliveredOrders.reduce((sum, o) => sum + (o.delivery_fee || 0), 0);

  // 2. Sum all approved logistics withdrawals
  const totalWithdrawn = await Withdrawal.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  const withdrawnAmount = totalWithdrawn.length > 0 ? totalWithdrawn[0].total : 0;

  return Math.max(0, totalFees - withdrawnAmount);
};

/**
 * @desc    Request a withdrawal (Logistics Provider)
 * @route   POST /wallet/withdrawals
 * @access  Private (Logistics Provider)
 */
const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails, saveBankDetails } = req.body;
  const userId = req.user._id;

  if (amount < 1000) {
    throw new AppError("Minimum withdrawal amount is ₦1,000", 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  // Calculate total pending withdrawals (Shared for all logistics)
  const pendingWithdrawals = await Withdrawal.find({ 
    status: "pending" 
  });
  
  const totalPending = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
  const sharedBalance = await getLogisticsSharedBalance();
  const availablePool = sharedBalance - totalPending;

  if (availablePool < amount) {
    throw new AppError("Insufficient shared available balance (checking global pending requests)", 400);
  }

  const withdrawal = await Withdrawal.create({
    userId,
    amount,
    currency: "NGN",
    bankDetails,
    status: "pending"
  });

  // If user wants to save bank details to profile
  if (saveBankDetails) {
    user.accountNo = bankDetails.accountNumber;
    user.bankName = bankDetails.bankName;
    user.accountName = bankDetails.accountName;
    await user.save();
  }

  res.status(201).json({
    success: true,
    message: "Withdrawal request submitted successfully",
    withdrawal
  });
});

/**
 * @desc    Get withdrawal requests (Admin: all, User: own)
 * @route   GET /wallet/withdrawals
 * @access  Private
 */
const getWithdrawals = asyncHandler(async (req, res) => {
  const isAdmin = req.user.roles.includes("admin") || req.user.roles.includes("super_admin");
  const query = isAdmin ? {} : { userId: req.user._id };
  
  // If admin, they might want to filter by status
  if (isAdmin && req.query.status) {
    query.status = req.query.status;
  }

  const withdrawals = await Withdrawal.find(query)
    .populate("userId", "firstName lastName email phone")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: withdrawals.length,
    withdrawals
  });
});

/**
 * @desc    Approve a withdrawal request (Admin)
 * @route   PATCH /wallet/withdrawals/:id/approve
 * @access  Private (Admin)
 */
const approveWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const withdrawal = await Withdrawal.findById(id);
  if (!withdrawal) {
    throw new AppError("Withdrawal request not found", 404);
  }

  if (withdrawal.status !== "pending") {
    throw new AppError(`Cannot approve a withdrawal that is already ${withdrawal.status}`, 400);
  }

  const user = await User.findById(withdrawal.userId);
  if (!user) {
    throw new AppError("User associated with this request not found", 404);
  }

  if (await getLogisticsSharedBalance() < withdrawal.amount) {
    throw new AppError("Insufficient shared pool balance to complete this withdrawal", 400);
  }

  // 1. Note: For logistics shared pool, we don't deduct from individual account_Balance
  // The sharedBalance helper already accounts for approved withdrawals.
  // We just proceed to ledger creation.

  // 2. Create Ledger Entry
  const reference = `WDL-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
  const ledger = await WalletLedger.create({
    userId: user._id,
    walletId: user.walletId || "system",
    reference,
    type: "DEBIT",
    amount: withdrawal.amount,
    status: "SUCCESS",
    channel: "WITHDRAWAL",
    beneficiaryAccount: `${withdrawal.bankDetails.accountNumber} (${withdrawal.bankDetails.bankName})`,
    transactionDate: new Date()
  });

  // 3. Update Withdrawal Status
  withdrawal.status = "approved";
  withdrawal.adminNote = adminNote;
  withdrawal.processedAt = new Date();
  withdrawal.ledgerId = ledger._id;
  await withdrawal.save();

  res.status(200).json({
    success: true,
    message: "Withdrawal approved and balance deducted",
    withdrawal
  });
});

/**
 * @desc    Reject a withdrawal request (Admin)
 * @route   PATCH /wallet/withdrawals/:id/reject
 * @access  Private (Admin)
 */
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { adminNote } = req.body;

  const withdrawal = await Withdrawal.findById(id);
  if (!withdrawal) {
    throw new AppError("Withdrawal request not found", 404);
  }

  if (withdrawal.status !== "pending") {
    throw new AppError(`Cannot reject a withdrawal that is already ${withdrawal.status}`, 400);
  }

  withdrawal.status = "rejected";
  withdrawal.adminNote = adminNote;
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  res.status(200).json({
    success: true,
    message: "Withdrawal request rejected",
    withdrawal
  });
});

module.exports = {
  requestWithdrawal,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
};
