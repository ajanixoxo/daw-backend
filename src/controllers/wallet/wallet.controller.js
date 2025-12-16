const vigipayClient = require("../../utils/vigipayClient/vigipayClient.js");
const User = require("../../models/userModel/user.js");

exports.createStatic = async (req, res) => {
  try {
    const userId = req.user._id; 
    const{ bvn, dateOfBirth } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    
    if (user.walletId) {
      return res.status(400).json({ message: "Wallet already exists" });
    }

    const response = await vigipayClient.post("/api/VirtualAccount/create", {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber:user.phone,
      bvn,
      dateOfBirth,
      webhookUrl: process.env.WEBHOOK_URL,
    });

    const accountId = response.data.responseData.accountId;

    // Save accountId to user
    user.accountId = accountId;
    await user.save();

    return res.status(201).json({
      message: "Wallet created successfully",
      accountId,
      data: response.data.responseData,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Wallet creation failed",
      error: error.response?.data || error.message,
    });
  }
};


exports.getBusinessWallet = async( req, res ) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user || !user.walletId) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const response = await vigipayClient.get(`/api/Wallet/businessWallet`);

    const walletData = response.data.responseData.walletID;

    user.walletId = walletData;
    await user.save();

    return res.status(200).json({
      message: "Wallet retrieved successfully",
      data: response.data.responseData,
    });
  } catch (error) {
    return res.status(500).json({
      message: "failed to fetch wallet",
      error: error.response?.data || error.message,
    });
  }
};

//update walletPin
exports.updateWalletPin = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pin } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.walletId) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const response = await vigipayClient.put(
      "/api/Wallet/updatePin",
      {
        walletId: user.walletId,
        pin,
      },
      {
        baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL,
      }
    );

    return res.status(200).json({
      message: "Wallet PIN updated successfully",
      data: response.data,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to update wallet PIN",
      error: error.response?.data || error.message,
    });
  }
};

//process payout
exports.processPayout = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pin, amount, bankCode, accountNumber, accountName } = req.body;

    
    const user = await User.findById(userId);
    if (!user || !user.walletId) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const chargeRes = await vigipayClient.post("/api/Wallet/charge", {
      amount,
      transferType: "WalletToAccount",
    });

    const { totalAmount } = chargeRes.data.responseData;

    
    const balanceRes = await vigipayClient.get("/api/Wallet/businessWallet");
    const availableBalance =
      balanceRes.data.responseData.availableBalance;

  
    if (availableBalance < totalAmount) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        availableBalance,
        requiredAmount: totalAmount,
      });
    }

    
    const payoutRes = await vigipayClient.post(
      "/api/Wallet/transfer/account",
      {
        senderWalletId: user.walletId,
        pin,
        amount,
        bankCode,
        accountNumber,
        accountName,
      }
    );

    return res.status(200).json({
      message: "Payout initiated",
      data: payoutRes.data,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Payout failed",
      error: error.response?.data || error.message,
    });
  }
};



//payout charges
exports.getPayoutCharge = async (req, res) => {
  try {
    const { amount, transferType = "WalletToAccount" } = req.body;

    const response = await vigipayClient.post("/api/Wallet/charge", {
      amount,
      transferType,
    });

    return res.status(200).json({
      message: "Charge retrieved successfully",
      data: response.data.responseData,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to get payout charge",
      error: error.response?.data || error.message,
    });
  }
};

//lookup
exports.accountLookup = async (req, res) => {
  try {
    const { bankCode, accNumber } = req.body;

    const response = await vigipayClient.post(
      "/api/Wallet/accountLookup",
      {
        bankCode,
        accNumber,
      },
      {
        baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL,
      }
    );

    return res.status(200).json({
      message: "Account verified successfully",
      data: response.data.responseData,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Account verification failed",
      error: error.response?.data || error.message,
    });
  }
};

//banks
exports.getBanks = async (req, res) => {
  try {
    const response = await vigipayClient.get(
      "/api/Wallet/banks",
      {
        baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL,
      }
    );

    return res.status(200).json({
      message: "Banks retrieved successfully",
      data: response.data.responseData,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch banks",
      error: error.response?.data || error.message,
    });
  }
};
