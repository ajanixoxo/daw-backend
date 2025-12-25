const vigipayClient = require("../../utils/vigipayClient/vigipayClient.js");
const User = require("../../models/userModel/user.js");
const walletLedger = require('../../models/walletLedger/ledger.js');

exports.createStatic = async (req, res) => {
  try {
    const userId = req.user._id;
    const { bvn, dateOfBirth } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.accountId) {
      return res.status(400).json({ message: "Account already exists" });
    }
    // console.log("Vigipay Response:");
    const response = await vigipayClient.post("/api/VirtualAccount/create", {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phone,
      bvn,
      dateOfBirth,
      webhookUrl: process.env.WEBHOOK_URL,
    });
    console.log("Vigipay Response:", response);
    const accountId = response.data.responseData.accountId;
    console.log("Vigipay Account ID:", accountId);
    // Save accountId to user
    user.accountId = accountId;
    user.accountNo = response.data.responseData.accountNo;
    user.accountName = response.data.responseData.accountName;
    user.bankName = response.data.responseData.bankName;
    user.bankCode = response.data.responseData.bankCode;
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

exports.getBusinessWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    console.log("vigipay starting")
    const response = await vigipayClient.get("/api/Wallet/businessWallet");
    console.log("response for wallet from vigipay", response);

    const walletData = response.data.responseData.walletID;
    const currentBalance = response.data.responseData.currentBalance;

    if (!user.walletId) {
      user.walletId = walletData;
    }

    user.wallet_balance = currentBalance;

    await user.save();

    return res.status(200).json({
      message: "Wallet retrieved successfully",
      data: response.data.responseData,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch wallet",
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

    const existingLedger = await WalletLedger.findOne({
      reference,
      type: "DEBIT",
    });

    if (existingLedger) {
      return res.status(409).json({
        message: "Payout already processed",
      });
    }

    if (existingLedger) {
      return res.status(409).json({
        message: "Payout already processed",
      });
    }


    const chargeRes = await vigipayClient.post("/api/Wallet/charge", {
      amount,
      transferType: "WalletToAccount",
    });

    const { totalAmount } = chargeRes.data.responseData;

    const balanceRes = await vigipayClient.get("/api/Wallet/businessWallet");
    const availableBalance = balanceRes.data.responseData.availableBalance;

    if (availableBalance < totalAmount) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        availableBalance,
        requiredAmount: totalAmount,
      });
    }

    const ledger = await WalletLedger.create({
      userId: user._id,
      walletId: user.walletId,
      reference,
      type: "DEBIT",
      amount,
      status: "PENDING",
      beneficiaryAccount: accountNumber,
      channel: "vigipay",
      transactionDate: new Date(),
    });

    const payoutRes = await vigipayClient.post("/api/Wallet/transfer/account", {
      senderWalletId: user.walletId,
      pin,
      amount,
      bankCode,
      accountNumber,
      accountName,
    });

    ledger.status = "SUCCESS";
    ledger.rawWebhookPayload = payoutRes.data;
    await ledger.save();

    return res.status(200).json({
      message: "Payout initiated",
      data: payoutRes.data,
    });
  } catch (error) {
    if (reference) {
      await WalletLedger.findOneAndUpdate(
        { reference },
        { status: "FAILED" }
      );
    }

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
    const response = await vigipayClient.get("/api/Wallet/banks", {
      baseURL: process.env.VIGIPAY_CUSTOMER_BASE_URL,
    });

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

//get account details 
exports.getAccount = async( res, req) => {
  try{
    const userId = req.user._id;
    const user = await User.findById(userId);
    if(!user){
      res.status(400).josn({
        success:"false",
        message:"User did not exist "
      })
    }

    const response = await vigipayClient(`/api/VirtualAccount/get?accountId=${user.accountId}`);
  
    user.aacount_Balance = response.data.responseData.accountBalance;
    await user.save();

    return res.status(200).json({
       success: "True",
       message:"Response fetched successfully",
       response: response.data.responseData,
    })

  }catch(error){
    console.log("Error during fetching user account");
    return res.status(500).json({
      message:"Error in fetching the account",
      error: error.message
    });
  }
};


exports.walletLedgerController = async(req, res) => {
  try {
    const userId = req.user._id;
    const user = await user.findById(userId);

    if(!user){
        return res.status(400).json({
        success: false,
        message:"User does not exist"
      });
     }
     
    const wallet = await walletLedger.find();
    // console.log("wallet ledger", wallet);
    if(!wallet){
      return res.status(400).json({
        success: false,
        message:"Wallet does not exist"
      });
    }

    return res.status(200).json({
      success: true,
      message:"Wallet fetched successfully",
      walletLedger: wallet
    });

  } catch (error) {
    console.log("Error during fetching wallet ledger");
    return res.status(500).json({
      message:"Error in fetching the account",
      error: error.message
    });
  }
}